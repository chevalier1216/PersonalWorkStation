import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultPort,
  executorPrompt,
  originAllowed,
  validateExecuteBody,
} from "./local-executor-lib.mjs";

const root = resolve(process.env.PWS_REPO_ROOT || process.cwd());
const schema = fileURLToPath(
  new URL("./local-executor-output.schema.json", import.meta.url),
);
const port = Number(process.env.PWS_EXECUTOR_PORT || defaultPort);
const configuredOrigins = process.env.PWS_ALLOWED_ORIGINS || "";
let active = false;

async function rpc(body, action, payload = {}) {
  const response = await fetch(
    `${body.supabaseUrl}/rest/v1/rpc/workflow_command`,
    {
      method: "POST",
      headers: {
        apikey: body.publishableKey,
        authorization: `Bearer ${body.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action, payload }),
    },
  );
  if (!response.ok)
    throw new Error(
      `Workflow RPC ${response.status}: ${(await response.text()).slice(0, 500)}`,
    );
  return response.json();
}

async function update(body, action, payload) {
  return rpc(body, action, payload);
}
function node(state, runId, key) {
  return state.nodes.find(
    (item) => item.run_id === runId && item.node_key === key,
  );
}

async function execute(body) {
  const state = await rpc(body, "load");
  const run = state.runs.find((item) => item.id === body.runId);
  if (!run) throw new Error("找不到 Run");
  if (!["waiting_external", "queued", "retrying"].includes(run.status))
    throw new Error(`Run 狀態 ${run.status} 不可交付執行`);
  const trigger = node(state, run.id, "trigger");
  const request = String(trigger?.input?.request || run.title);
  const context = node(state, run.id, "context");
  const execution = node(state, run.id, "execution");
  const verification = node(state, run.id, "verification");
  const output = node(state, run.id, "output");
  for (const item of [context, execution, verification, output])
    if (!item) throw new Error("Run 缺少必要 Node");
  await update(body, "update_node", {
    node_id: context.id,
    status: "running",
    tool: "local-executor",
  });
  await update(body, "update_node", {
    node_id: context.id,
    status: "success",
    output: { repository: root, rules_loaded: true },
  });
  await update(body, "update_node", {
    node_id: execution.id,
    status: "running",
    tool: "codex exec",
  });
  await update(body, "record_log", {
    run_id: run.id,
    node_id: execution.id,
    level: "info",
    summary: "已交付本機 Codex CLI",
  });
  const temp = await mkdtemp(join(tmpdir(), "pws-executor-"));
  const resultFile = join(temp, "result.json");
  try {
    const executable = process.platform === "win32" ? "codex.cmd" : "codex";
    const args = [
      "exec",
      "-C",
      root,
      "--sandbox",
      "workspace-write",
      "--approve-for-me",
      "--output-schema",
      schema,
      "--output-last-message",
      resultFile,
      "-",
    ];
    const exitCode = await new Promise((resolveCode, reject) => {
      const child = spawn(executable, args, {
        shell: false,
        stdio: ["pipe", "ignore", "pipe"],
        windowsHide: true,
      });
      let errors = "";
      child.stderr.on("data", (chunk) => {
        errors = (errors + chunk.toString()).slice(-8000);
      });
      child.on("error", reject);
      child.on("close", (code) => resolveCode({ code: code ?? 1, errors }));
      child.stdin.end(executorPrompt(run, request));
    });
    if (exitCode.code !== 0)
      throw new Error(
        `Codex CLI 結束碼 ${exitCode.code}: ${exitCode.errors.slice(-2000)}`,
      );
    const result = JSON.parse(await readFile(resultFile, "utf8"));
    if (result.human_gate) {
      await update(body, "open_human_gate", {
        node_id: execution.id,
        reason: result.human_gate.reason,
        prompt: result.human_gate.prompt,
      });
      await update(body, "record_log", {
        run_id: run.id,
        node_id: execution.id,
        level: "warning",
        summary: `等待人工處理：${result.human_gate.prompt}`,
      });
      return { ok: true, waitingHuman: true };
    }
    await update(body, "update_node", {
      node_id: execution.id,
      status: "success",
      output: { summary: result.summary },
    });
    await update(body, "update_node", {
      node_id: verification.id,
      status: "running",
      tool: "codex reported checks",
    });
    const passed =
      result.verification?.passed === true &&
      Array.isArray(result.verification?.checks) &&
      result.verification.checks.length > 0;
    await update(body, "update_node", {
      node_id: verification.id,
      status: passed ? "success" : "failed",
      verification: { passed, checks: result.verification?.checks || [] },
      error: passed ? "" : "Codex 未提供通過的必要驗證",
    });
    if (!passed) throw new Error("必要驗證未通過");
    for (const artifact of result.artifacts || [])
      await update(body, "record_artifact", {
        run_id: run.id,
        node_id: output.id,
        kind: artifact.kind,
        label: artifact.label,
        url: artifact.url || "",
      });
    await update(body, "update_node", {
      node_id: output.id,
      status: "running",
      tool: "local-executor",
    });
    await update(body, "update_node", {
      node_id: output.id,
      status: "success",
      output: {
        summary: result.summary,
        artifact_count: result.artifacts?.length || 0,
      },
    });
    await update(body, "complete_run", {
      run_id: run.id,
      output: result.summary,
    });
    return { ok: true };
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    await update(body, "update_node", {
      node_id: execution.id,
      status: "failed",
      error: message,
    }).catch(() => {});
    await update(body, "record_log", {
      run_id: run.id,
      node_id: execution.id,
      level: "error",
      summary: message,
    }).catch(() => {});
    throw reason;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin || "";
  if (!originAllowed(origin, configuredOrigins)) {
    response.writeHead(403);
    return response.end("Origin denied");
  }
  const headers = {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "content-type": "application/json; charset=utf-8",
  };
  if (request.method === "OPTIONS") {
    response.writeHead(204, headers);
    return response.end();
  }
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, headers);
    return response.end(JSON.stringify({ ok: true, active, root }));
  }
  if (request.method !== "POST" || request.url !== "/execute") {
    response.writeHead(404, headers);
    return response.end(JSON.stringify({ error: "Not found" }));
  }
  if (active) {
    response.writeHead(409, headers);
    return response.end(JSON.stringify({ error: "已有 Run 執行中" }));
  }
  active = true;
  try {
    let raw = "";
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 200000) throw new Error("Request too large");
    }
    const result = await execute(validateExecuteBody(JSON.parse(raw)));
    response.writeHead(200, headers);
    response.end(JSON.stringify(result));
  } catch (reason) {
    response.writeHead(500, headers);
    response.end(
      JSON.stringify({
        error: reason instanceof Error ? reason.message : String(reason),
      }),
    );
  } finally {
    active = false;
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `PersonalWorkStation executor listening on http://127.0.0.1:${port}`,
  ),
);
