import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CODEX_LABELS,
  acquireLease,
  assertCodexResult,
  blockedComment,
  buildCodexPrompt,
  classifyHumanGate,
  issueBranch,
  isReadyIssue,
  labelNames,
  loadRunState,
  releaseLease,
  recoveryDisposition,
  repoStateKey,
  resultComment,
  sanitizeForLog,
  saveRunState,
  selectReadyIssue,
  validateWorkerConfig,
} from "./github-issue-worker-lib.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const schemaSource = join(
  scriptDirectory,
  "github-issue-worker-output.schema.json",
);

function parseArguments(argv) {
  const options = { mode: "run", configPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--config") options.configPath = argv[++index] || "";
    else if (argument === "--setup") options.mode = "setup";
    else if (argument === "--doctor") options.mode = "doctor";
    else throw new Error(`未知參數：${argument}`);
  }
  if (!options.configPath) throw new Error("必須提供 --config <path>");
  options.configPath = resolve(options.configPath);
  return options;
}

async function runProcess(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: false,
      windowsHide: true,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 2_000_000) stdout = stdout.slice(-2_000_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 100_000) stderr = stderr.slice(-100_000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const result = { code: code ?? 1, stdout, stderr };
      if (result.code !== 0 && options.allowFailure !== true) {
        const error = new Error(
          sanitizeForLog(
            `${command} 結束碼 ${result.code}: ${stderr || stdout || "無輸出"}`,
          ),
        );
        error.result = result;
        reject(error);
        return;
      }
      resolveRun(result);
    });
    if (options.input !== undefined) child.stdin.end(options.input);
  });
}

function parseJsonOutput(result, context) {
  try {
    return JSON.parse(result.stdout || "null");
  } catch {
    throw new Error(`${context} 回傳非 JSON 資料`);
  }
}

async function ghJson(repository, args) {
  return parseJsonOutput(
    await runProcess("gh", [...args, "--repo", repository.nameWithOwner], {
      cwd: repository.repositoryRoot,
    }),
    `gh ${args[0] || "command"}`,
  );
}

async function gh(repository, args, options = {}) {
  return runProcess("gh", [...args, "--repo", repository.nameWithOwner], {
    cwd: repository.repositoryRoot,
    ...options,
  });
}

async function checkExecutables(repository) {
  for (const [command, args] of [
    ["node", ["--version"]],
    ["git", ["--version"]],
    ["gh", ["--version"]],
    ["codex", ["--version"]],
  ]) {
    await runProcess(command, args, { cwd: repository.repositoryRoot });
  }
}

async function checkGitHubAuthentication(repository) {
  await runProcess("gh", ["auth", "status", "--hostname", "github.com"], {
    cwd: repository.repositoryRoot,
  });
  const result = await runProcess(
    "gh",
    [
      "repo",
      "view",
      repository.nameWithOwner,
      "--json",
      "nameWithOwner,viewerPermission",
    ],
    { cwd: repository.repositoryRoot },
  );
  const viewed = parseJsonOutput(result, "gh repo view");
  if (viewed.nameWithOwner !== repository.nameWithOwner) {
    throw new Error(`GitHub repository identity 不符：${viewed.nameWithOwner}`);
  }
}

async function checkRepositoryIdentity(repository) {
  const topLevel = (
    await git(repository, ["rev-parse", "--show-toplevel"])
  ).stdout.trim();
  if (
    resolve(topLevel).toLowerCase() !==
    resolve(repository.repositoryRoot).toLowerCase()
  ) {
    throw new Error(`Repository root identity 不符：${topLevel}`);
  }
  const remote = (await git(repository, ["remote", "get-url", "origin"])).stdout
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.git$/i, "");
  const expectedSuffix = repository.nameWithOwner.toLowerCase();
  if (!remote.toLowerCase().endsWith(expectedSuffix)) {
    throw new Error(`origin 不符合白名單 repository：${remote}`);
  }
}

async function ensureLabels(repository) {
  const definitions = [
    [CODEX_LABELS.ready, "等待 Windows Codex Worker 接手", "1D76DB"],
    [CODEX_LABELS.running, "Codex Worker 已取得執行權", "FBCA04"],
    [CODEX_LABELS.blocked, "等待 Human Gate", "D93F0B"],
    [CODEX_LABELS.done, "已建立可追蹤交付結果", "0E8A16"],
  ];
  for (const [name, description, color] of definitions) {
    await gh(repository, [
      "label",
      "create",
      name,
      "--description",
      description,
      "--color",
      color,
      "--force",
    ]);
  }
}

async function listReadyIssues(repository) {
  return ghJson(repository, [
    "issue",
    "list",
    "--state",
    "open",
    "--label",
    CODEX_LABELS.ready,
    "--limit",
    "20",
    "--json",
    "number,title,body,state,labels,url",
  ]);
}

async function viewIssue(repository, issueNumber) {
  return ghJson(repository, [
    "issue",
    "view",
    String(issueNumber),
    "--json",
    "number,title,body,state,labels,url",
  ]);
}

async function editIssueLabels(
  repository,
  issueNumber,
  { add = [], remove = [] },
) {
  const args = ["issue", "edit", String(issueNumber)];
  for (const label of add) args.push("--add-label", label);
  for (const label of remove) args.push("--remove-label", label);
  await gh(repository, args);
}

async function commentIssue(repository, issueNumber, body) {
  await gh(
    repository,
    ["issue", "comment", String(issueNumber), "--body-file", "-"],
    {
      input: body,
    },
  );
}

async function findPullRequest(repository, branch) {
  const pullRequests = await ghJson(repository, [
    "pr",
    "list",
    "--state",
    "all",
    "--head",
    branch,
    "--limit",
    "2",
    "--json",
    "number,url,state,headRefName,headRefOid,baseRefName",
  ]);
  return (
    pullRequests.find((pullRequest) => pullRequest.headRefName === branch) ||
    null
  );
}

async function git(repository, args, options = {}) {
  return runProcess(
    "git",
    ["-c", `safe.directory=${repository.repositoryRoot}`, ...args],
    {
      cwd: repository.repositoryRoot,
      ...options,
    },
  );
}

async function prepareBranch(repository, branch) {
  const status = await git(repository, ["status", "--porcelain"]);
  if (status.stdout.trim()) {
    throw new Error(
      "Repository 有未提交變更；請先保存或清理既有工作，再重新加入 codex:ready",
    );
  }
  await git(repository, ["fetch", "--prune", "origin"]);
  const local = await git(
    repository,
    ["show-ref", "--verify", `refs/heads/${branch}`],
    {
      allowFailure: true,
    },
  );
  if (local.code === 0) {
    await git(repository, ["switch", branch]);
    return;
  }
  const remote = await git(
    repository,
    ["show-ref", "--verify", `refs/remotes/origin/${branch}`],
    { allowFailure: true },
  );
  if (remote.code === 0) {
    await git(repository, [
      "switch",
      "--track",
      "-c",
      branch,
      `origin/${branch}`,
    ]);
    return;
  }
  await git(repository, [
    "switch",
    "-c",
    branch,
    `origin/${repository.baseBranch}`,
  ]);
}

async function runCodex({
  repository,
  issue,
  branch,
  attempt,
  recovery,
  schemaPath,
  resultPath,
}) {
  await rm(resultPath, { force: true });
  const prompt = buildCodexPrompt({
    repository,
    issue,
    branch,
    attempt,
    recovery,
  });
  const executable = process.platform === "win32" ? "codex.exe" : "codex";
  const run = await runProcess(
    executable,
    [
      "exec",
      "-C",
      repository.repositoryRoot,
      "--approve-for-me",
      "--output-schema",
      schemaPath,
      "--output-last-message",
      resultPath,
      "-",
    ],
    {
      cwd: repository.repositoryRoot,
      input: prompt,
      env: {
        ...process.env,
        CODEX_HOME: process.env.CODEX_HOME || join(homedir(), ".codex"),
      },
    },
  );
  const raw = await readFile(resultPath, "utf8");
  return { result: assertCodexResult(JSON.parse(raw)), stderr: run.stderr };
}

async function markBlocked(repository, issue, statePath, branch, reason) {
  await editIssueLabels(repository, issue.number, {
    add: [CODEX_LABELS.blocked],
    remove: [CODEX_LABELS.ready, CODEX_LABELS.running],
  });
  await commentIssue(repository, issue.number, blockedComment(reason));
  await saveRunState(statePath, {
    issueNumber: issue.number,
    branch,
    status: "blocked",
    blockedAt: new Date().toISOString(),
    reason: sanitizeForLog(reason),
  });
}

async function finishIssue(
  repository,
  issue,
  statePath,
  branch,
  result,
  pullRequest,
) {
  const commit = pullRequest.headRefOid || result.commit_sha || "";
  await commentIssue(
    repository,
    issue.number,
    resultComment({ branch, result, pullRequest, commit }),
  );
  await editIssueLabels(repository, issue.number, {
    add: [CODEX_LABELS.done],
    remove: [CODEX_LABELS.ready, CODEX_LABELS.running, CODEX_LABELS.blocked],
  });
  await saveRunState(statePath, {
    issueNumber: issue.number,
    branch,
    status: "done",
    completedAt: new Date().toISOString(),
    commit,
    pullRequest: pullRequest.url,
  });
}

async function claimIssue(repository, issue, branch, workerName) {
  const latest = await viewIssue(repository, issue.number);
  if (!isReadyIssue(latest)) return null;
  const existingPullRequest = await findPullRequest(repository, branch);
  await editIssueLabels(repository, latest.number, {
    add: [CODEX_LABELS.running],
    remove: [CODEX_LABELS.ready, CODEX_LABELS.blocked],
  });
  const claimed = await viewIssue(repository, latest.number);
  const claimedLabels = labelNames(claimed);
  if (
    !claimedLabels.has(CODEX_LABELS.running) ||
    claimedLabels.has(CODEX_LABELS.ready)
  ) {
    throw new Error(`Issue #${latest.number} Claim 驗證失敗`);
  }
  await commentIssue(
    repository,
    latest.number,
    [
      "Codex Worker 已取得執行權。",
      "",
      `- Worker: \`${workerName}\``,
      `- 開始時間: \`${new Date().toISOString()}\``,
      `- Issue: #${latest.number}`,
      `- 預計 branch: \`${branch}\``,
      existingPullRequest
        ? `- Recovery PR: ${existingPullRequest.url}`
        : "- Recovery PR: 無",
    ].join("\n"),
  );
  return {
    issue: claimed,
    recovery: Boolean(existingPullRequest),
    pullRequest: existingPullRequest,
  };
}

async function recoverIssue(repository, currentState) {
  if (!currentState?.issueNumber || currentState.status === "done") return null;
  const issue = await viewIssue(repository, currentState.issueNumber);
  const disposition = recoveryDisposition(issue);
  if (disposition !== "ignore") {
    const branch = currentState.branch || issueBranch(issue);
    return {
      issue,
      branch,
      recovery: true,
      requiresClaim: disposition === "reclaim",
      pullRequest: await findPullRequest(repository, branch),
    };
  }
  return null;
}

async function processRepository(config, repository, stateRoot) {
  const key = repoStateKey(repository.nameWithOwner);
  const repositoryStateRoot = join(stateRoot, key);
  await mkdir(repositoryStateRoot, { recursive: true });
  const leasePath = join(repositoryStateRoot, "worker.lock");
  const statePath = join(repositoryStateRoot, "run.json");
  const circuitPath = join(repositoryStateRoot, "auth-circuit.json");
  const schemaPath = join(repositoryStateRoot, "codex-output.schema.json");
  const resultPath = join(repositoryStateRoot, "codex-result.json");
  await writeFile(schemaPath, await readFile(schemaSource, "utf8"), "utf8");
  const lease = await acquireLease(leasePath, config.staleAfterMinutes);
  if (!lease.acquired) {
    console.log(`${repository.nameWithOwner}: 已有 Worker 執行中，跳過本輪。`);
    return { status: "busy" };
  }
  try {
    try {
      await readFile(circuitPath, "utf8");
      console.log(
        `${repository.nameWithOwner}: GitHub authentication circuit 已暫停；恢復認證後執行 --doctor。`,
      );
      return { status: "auth-blocked" };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    try {
      await checkGitHubAuthentication(repository);
    } catch (error) {
      await writeFile(
        circuitPath,
        JSON.stringify(
          {
            status: "paused",
            reason: sanitizeForLog(error.message),
            failedAt: new Date().toISOString(),
            recovery: "恢復既有 gh 認證後執行 worker --doctor",
          },
          null,
          2,
        ),
        "utf8",
      );
      console.error(
        `${repository.nameWithOwner}: GitHub authentication failure；已開啟本機 circuit，停止自動重試。`,
      );
      return { status: "auth-blocked" };
    }
    let work = await recoverIssue(repository, await loadRunState(statePath));
    if (!work) {
      const issue = selectReadyIssue(await listReadyIssues(repository));
      if (!issue) {
        console.log(
          `${repository.nameWithOwner}: 沒有符合條件的 codex:ready Issue。`,
        );
        return { status: "idle" };
      }
      const branch = issueBranch(issue);
      const claim = await claimIssue(
        repository,
        issue,
        branch,
        config.workerName,
      );
      if (!claim) return { status: "lost-claim" };
      work = { ...claim, branch };
    }
    if (work?.requiresClaim) {
      const claim = await claimIssue(
        repository,
        work.issue,
        work.branch,
        config.workerName,
      );
      if (!claim) return { status: "lost-claim" };
      work = { ...claim, branch: work.branch, recovery: true };
    }
    const { issue, branch } = work;
    await saveRunState(statePath, {
      issueNumber: issue.number,
      branch,
      status: "running",
      workerName: config.workerName,
      startedAt: new Date().toISOString(),
      recovery: work.recovery,
    });
    if (work.pullRequest?.state === "MERGED") {
      const verification = {
        passed: true,
        checks: ["偵測到既有 PR，未建立重複 Branch 或 PR"],
      };
      await finishIssue(
        repository,
        issue,
        statePath,
        branch,
        {
          summary: "恢復既有交付結果。",
          verification,
          commit_sha: work.pullRequest.headRefOid,
        },
        work.pullRequest,
      );
      return {
        status: "done",
        issue: issue.number,
        pullRequest: work.pullRequest.url,
      };
    }
    try {
      await prepareBranch(repository, branch);
    } catch (error) {
      await markBlocked(repository, issue, statePath, branch, error.message);
      return { status: "blocked", issue: issue.number };
    }
    let lastError = null;
    for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
      try {
        const { result } = await runCodex({
          repository,
          issue,
          branch,
          attempt,
          recovery: work.recovery,
          schemaPath,
          resultPath,
        });
        if (result.human_gate) {
          await markBlocked(
            repository,
            issue,
            statePath,
            branch,
            result.human_gate.prompt || result.human_gate.reason,
          );
          return { status: "blocked", issue: issue.number };
        }
        const pullRequest = await findPullRequest(repository, branch);
        if (!pullRequest) throw new Error("Codex 完成後找不到對應 PR");
        await finishIssue(
          repository,
          issue,
          statePath,
          branch,
          result,
          pullRequest,
        );
        return {
          status: "done",
          issue: issue.number,
          pullRequest: pullRequest.url,
        };
      } catch (error) {
        lastError = error;
        const message = sanitizeForLog(error.message);
        if (classifyHumanGate(message)) break;
        if (attempt < config.maxAttempts) {
          await commentIssue(
            repository,
            issue.number,
            `Codex Worker 第 ${attempt} 次執行未完成，將進行最後的有界修復重試。\n\n\`${message.slice(0, 800)}\``,
          );
        }
      }
    }
    await markBlocked(
      repository,
      issue,
      statePath,
      branch,
      lastError?.message || "有界重試後仍未完成，請檢查執行紀錄。",
    );
    return { status: "blocked", issue: issue.number };
  } finally {
    await releaseLease(leasePath);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const rawConfig = JSON.parse(await readFile(options.configPath, "utf8"));
  const config = validateWorkerConfig(rawConfig, options.configPath);
  const stateRoot = resolve(
    rawConfig.stateRoot ||
      process.env.PWS_ISSUE_WORKER_STATE ||
      join(
        process.env.LOCALAPPDATA || homedir(),
        "PersonalWorkStation",
        "codex-issue-worker",
      ),
  );
  await mkdir(stateRoot, { recursive: true });
  for (const repository of config.repositories) {
    await checkExecutables(repository);
    await checkRepositoryIdentity(repository);
    if (options.mode === "doctor") {
      await checkGitHubAuthentication(repository);
      const key = repoStateKey(repository.nameWithOwner);
      await rm(join(stateRoot, key, "auth-circuit.json"), { force: true });
      console.log(`${repository.nameWithOwner}: doctor 檢查通過。`);
      continue;
    }
    if (options.mode === "setup") {
      await checkGitHubAuthentication(repository);
      await ensureLabels(repository);
      console.log(`${repository.nameWithOwner}: labels 已建立或更新。`);
      continue;
    }
    const outcome = await processRepository(config, repository, stateRoot);
    console.log(
      JSON.stringify({ repository: repository.nameWithOwner, ...outcome }),
    );
  }
}

main().catch((error) => {
  console.error(
    sanitizeForLog(error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
});
