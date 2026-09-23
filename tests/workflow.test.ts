import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { alice, bob, database } from "./database";

describe("AI Execution Center persistence and verification", () => {
  let ctx: Awaited<ReturnType<typeof database>>;
  let taskId = "";
  let runId = "";

  beforeAll(async () => {
    ctx = await database();
    const workspace = await ctx.run("create_task", {
      title: "Workflow source task",
    });
    taskId = workspace.tasks.find(
      (task) => task.title === "Workflow source task",
    )!.id;
  }, 30000);

  afterAll(async () => {
    await ctx.db.close();
  });

  it("creates a unique observable Run with the required five nodes", async () => {
    const state = await ctx.runWorkflow("create_run", {
      title: "修正 Mahjong Issue #5",
      source: "AI Chat",
      project: "Mahjong",
      task_id: taskId,
      executor: "Codex",
      input: { request: "修正 Mahjong Issue #5" },
    });
    const run = state.runs[0];
    runId = run.id;
    expect(run.run_code).toMatch(/^RUN-\d{8}-0001$/);
    expect(run).toMatchObject({
      task_id: taskId,
      status: "waiting_external",
      project: "Mahjong",
    });
    expect(
      state.nodes
        .filter((node) => node.run_id === run.id)
        .map((node) => node.node_key),
    ).toEqual(["trigger", "context", "execution", "verification", "output"]);
    const ordered = state.nodes.filter((node) => node.run_id === run.id);
    expect(ordered.slice(1).every((node) => node.parent_node_id)).toBe(true);
    expect(
      state.events.some((event) => event.event_type === "run_created"),
    ).toBe(true);
  });

  it("preserves retry history and only allows Success after verification", async () => {
    let state = await ctx.runWorkflow("load");
    const execution = state.nodes.find(
      (node) => node.run_id === runId && node.node_key === "execution",
    )!;
    state = await ctx.runWorkflow("update_node", {
      node_id: execution.id,
      status: "failed",
      error: "build failed",
    });
    state = await ctx.runWorkflow("retry_node", {
      node_id: execution.id,
      reason: "修正後重跑",
    });
    expect(state.nodes.find((node) => node.id === execution.id)).toMatchObject({
      status: "retrying",
      retry_count: 1,
    });
    expect(
      state.events.find((event) => event.event_type === "retry")?.details,
    ).toMatchObject({ previous_error: "build failed", retry_count: 1 });
    await expect(
      ctx.runWorkflow("complete_run", { run_id: runId }),
    ).rejects.toThrow(/必要 Node 未成功/);

    for (const node of state.nodes.filter((item) => item.run_id === runId)) {
      await ctx.runWorkflow("update_node", {
        node_id: node.id,
        status: "success",
        verification: node.node_key === "verification" ? { passed: true } : {},
      });
    }
    state = await ctx.runWorkflow("complete_run", {
      run_id: runId,
      output: "已完成並驗證",
    });
    expect(state.runs.find((run) => run.id === runId)).toMatchObject({
      status: "success",
      output: "已完成並驗證",
    });
  });

  it("records an allowed Human Gate and GitHub artifact without leaking owners", async () => {
    let state = await ctx.runWorkflow("create_run", {
      title: "需要 repository 權限",
      source: "Codex",
      project: "PersonalWorkStation",
    });
    const run = state.runs[0];
    const node = state.nodes.find(
      (item) => item.run_id === run.id && item.node_key === "context",
    )!;
    state = await ctx.runWorkflow("open_human_gate", {
      node_id: node.id,
      reason: "permission",
      prompt: "恢復 GitHub push 權限",
    });
    expect(state.runs.find((item) => item.id === run.id)).toMatchObject({
      status: "waiting_human",
      human_required: true,
    });
    expect(state.human_gates[0]).toMatchObject({
      reason: "permission",
      status: "open",
    });
    state = await ctx.runWorkflow("record_artifact", {
      run_id: run.id,
      node_id: node.id,
      kind: "commit",
      label: "8177fd7",
      url: "https://github.com/example/repo/commit/8177fd7",
      metadata: { repository: "example/repo" },
    });
    expect(state.artifacts[0]).toMatchObject({
      kind: "commit",
      label: "8177fd7",
    });
    state = await ctx.runWorkflow("record_artifact", {
      run_id: run.id,
      node_id: node.id,
      kind: "issue",
      label: "Issue #5",
      url: "https://github.com/example/repo/issues/5",
      metadata: { repository: "example/repo", number: 5 },
    });
    state = await ctx.runWorkflow("record_artifact", {
      run_id: run.id,
      node_id: node.id,
      kind: "pull_request",
      label: "PR #6",
      url: "https://github.com/example/repo/pull/6",
      metadata: { repository: "example/repo", number: 6 },
    });
    expect(state.artifacts.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["commit", "issue", "pull_request"]),
    );
    state = await ctx.runWorkflow("record_log", {
      run_id: run.id,
      node_id: node.id,
      level: "error",
      summary: "push authentication failed",
    });
    expect(state.logs[0]).toMatchObject({
      level: "error",
      summary: "push authentication failed",
    });
    state = await ctx.runWorkflow("pause_run", {
      run_id: run.id,
      reason: "QUOTA_PAUSED",
    });
    expect(state.runs.find((item) => item.id === run.id)).toMatchObject({
      status: "paused",
      pause_reason: "QUOTA_PAUSED",
    });
    state = await ctx.runWorkflow("resume_run", { run_id: run.id });
    expect(state.runs.find((item) => item.id === run.id)).toMatchObject({
      status: "queued",
      pause_reason: "",
    });
    await expect(ctx.runWorkflow("load", {}, bob)).rejects.toThrow(/尚未獲准/);
    await ctx.db.query("insert into public.allowed_users values($1)", [bob]);
    expect((await ctx.runWorkflow("load", {}, bob)).runs).toEqual([]);
    expect((await ctx.runWorkflow("load", {}, alice)).runs.length).toBe(2);
  });
});
