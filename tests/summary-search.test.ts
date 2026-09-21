import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { alice, bob, database } from "./database";

describe("M5 AI Summary and history search", () => {
  let ctx: Awaited<ReturnType<typeof database>>;
  let taskId = "";

  beforeAll(async () => {
    ctx = await database();
    let workspace = await ctx.run("create_task", { title: "M5 發佈驗證" });
    taskId = workspace.tasks.find((item) => item.title === "M5 發佈驗證")!.id;
    workspace = await ctx.run("edit_task", {
      id: taskId,
      title: "M5 發佈驗證",
      description: "確認歷史搜尋可用",
      priority: "High",
      due_at: "2026-09-30T07:00:00.000Z",
      start_date: "2026-09-29",
      estimated_minutes: 60,
      deliverable_type: "Document",
      deliverable_value: "release-candidate-report",
      recurrence_type: null,
      recurrence_interval: null,
      recurrence_unit: null,
    });
    await ctx.run("add_tag", {
      task_id: taskId,
      name: "Release",
      color: "#7895b2",
    });
    await ctx.run("add_note", {
      task_id: taskId,
      content: "人工驗收發現 production refresh 正常",
    });
    let ai = await ctx.runAI("create_conversation", { title: "M5 搜尋討論" });
    await ctx.runAI("append_message", {
      conversation_id: ai.conversations[0].id,
      role: "user",
      content: "找出 production refresh 的討論",
    });
  }, 30000);

  afterAll(async () => {
    await ctx.db.close();
  });

  it("creates immutable timestamp versions with latest backlinks", async () => {
    let state = await ctx.runSummary("create", {
      task_id: taskId,
      title: "M5 發佈驗證結果",
      decisions: ["先驗證 refresh"],
      completed: ["Task persistence"],
      cancelled: [],
      superseded: [],
      content: "已確認 Task persistence。",
    });
    const first = state.summaries[0];
    expect(first.version_label).toMatch(/^v\.\d{2}\.\d{2}\.\d{2}\.\d{4}$/);

    state = await ctx.runSummary("create", {
      task_id: taskId,
      title: "M5 分階段發布決策",
      decisions: ["改採分階段發布"],
      completed: ["production refresh"],
      cancelled: [],
      superseded: ["一次發布"],
      content: "已完成 refresh，後續分階段發布。",
    });
    const newest = state.summaries[0];
    const old = state.summaries.find((item) => item.id === first.id)!;
    expect(newest.previous_summary_id).toBe(first.id);
    expect(newest.version_label).toBe(`${first.version_label}-2`);
    expect(old.latest_summary_id).toBe(newest.id);
    expect(old.content).toBe("已確認 Task persistence。");
  });

  it("searches Notes, selected Task fields, chat and summaries with source links", async () => {
    const notes = await ctx.search("production refresh", "notes");
    expect(notes[0]).toMatchObject({ result_type: "note", task_id: taskId });
    expect(notes[0].note_id).toBeTruthy();

    expect(
      (await ctx.search("release-candidate", "deliverable"))[0],
    ).toMatchObject({
      matched_field: "deliverable",
      task_id: taskId,
    });
    expect((await ctx.search("Release", "tags"))[0].task_id).toBe(taskId);
    expect((await ctx.search("production refresh", "chat"))[0]).toMatchObject({
      result_type: "chat",
    });
    expect((await ctx.search("分階段發布", "summary"))[0]).toMatchObject({
      result_type: "summary",
      task_id: taskId,
    });
  });

  it("adds relevant Summaries but retrieves old chat only on an explicit request", async () => {
    const ordinary = (await ctx.runAI("context", {
      query: "production refresh",
    })) as unknown as { summaries: unknown[]; historical_chat: unknown[] };
    expect(ordinary.summaries.length).toBeGreaterThan(0);
    expect(ordinary.historical_chat).toEqual([]);

    const explicit = (await ctx.runAI("context", {
      query: "找我以前談過 production refresh 的內容",
    })) as unknown as { historical_chat: unknown[] };
    expect(explicit.historical_chat.length).toBeGreaterThan(0);
  });

  it("keeps Summary and search private to the allowed owner", async () => {
    await expect(ctx.runSummary("load", {}, bob)).rejects.toThrow(/尚未獲准/);
    await ctx.db.query("insert into public.allowed_users values($1)", [bob]);
    expect((await ctx.runSummary("load", {}, bob)).summaries).toEqual([]);
    expect(await ctx.search("M5", "all", bob)).toEqual([]);
    expect((await ctx.runSummary("load", {}, alice)).summaries.length).toBe(2);
  });
});
