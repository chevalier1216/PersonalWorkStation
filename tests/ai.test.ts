import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { alice, bob, database } from "./database";
import type { AIState } from "../src/ai";

describe("AI persistence and confirmation boundaries", () => {
  let ctx: Awaited<ReturnType<typeof database>>;
  beforeAll(async () => {
    ctx = await database();
  }, 30000);
  afterAll(async () => {
    await ctx.db.close();
  });

  it("persists conversations and returns only relevant limited context", async () => {
    let workspace = await ctx.run("create_task", { title: "季度預算審查" });
    const task = workspace.tasks.find((item) => item.title === "季度預算審查")!;
    await ctx.run("add_note", {
      task_id: task.id,
      content: "供應商成本增加百分之十",
    });
    await ctx.run("create_task", { title: "不相關任務" });

    let state = await ctx.runAI("create_conversation", { title: "預算討論" });
    const conversation = state.conversations[0];
    state = await ctx.runAI("append_message", {
      conversation_id: conversation.id,
      role: "user",
      content: "找季度預算",
    });
    expect(state.messages).toHaveLength(1);
    expect((await ctx.runAI("load")).messages[0].content).toBe("找季度預算");

    const context = (await ctx.runAI("context", {
      query: "季度 預算",
    })) as unknown as {
      tasks: Array<{ id: string; title: string }>;
      notes: Array<{ content: string }>;
      calendar: unknown[];
    };
    expect(context.tasks.map((item) => item.title)).toEqual(["季度預算審查"]);
    expect(context.notes[0].content).toContain("供應商成本");
    expect(context.tasks.length).toBeLessThanOrEqual(20);
    expect(context.notes.length).toBeLessThanOrEqual(30);
    expect(context.calendar.length).toBeLessThanOrEqual(30);
  });

  it("creates directly but preserves unspecified fields until a proposed edit is confirmed", async () => {
    let state = await ctx.runAI("create_task", {
      title: "AI 建立任務",
      description: "保留說明",
      priority: "High",
      due_at: "2026-09-25T07:00:00.000Z",
      start_date: "2026-09-24",
    });
    expect(state.conversations.some((item) => item.title === "預算討論")).toBe(
      true,
    );
    let workspace = await ctx.run("load");
    const task = workspace.tasks.find((item) => item.title === "AI 建立任務")!;
    await ctx.run("edit_task", {
      id: task.id,
      title: task.title,
      description: "保留說明",
      priority: "High",
      due_at: "2026-09-25T07:00:00.000Z",
      start_date: "2026-09-24",
      estimated_minutes: 45,
      deliverable_type: "Document",
      deliverable_value: "https://example.invalid/ai",
      recurrence_type: "weekly",
      recurrence_interval: 2,
      recurrence_unit: null,
    });
    state = await ctx.runAI("create_conversation", { title: "修改任務" });
    const conversationId = state.conversations[0].id;
    state = await ctx.runAI("create_pending_action", {
      conversation_id: conversationId,
      action_type: "edit_task",
      label: "修改 AI 建立任務",
      action_payload: { id: task.id, changes: { title: "AI 確認後修改" } },
    });
    const action = state.pending_actions[0];
    expect(
      (await ctx.run("load")).tasks.find((item) => item.id === task.id)?.title,
    ).toBe("AI 建立任務");
    state = await ctx.runAI("resolve_action", { id: action.id, confirm: true });
    expect(state.pending_actions[0].status).toBe("confirmed");
    workspace = await ctx.run("load");
    expect(workspace.tasks.find((item) => item.id === task.id)).toMatchObject({
      title: "AI 確認後修改",
      description: "保留說明",
      priority: "High",
      start_date: "2026-09-24",
      estimated_minutes: 45,
      deliverable_type: "Document",
      deliverable_value: "https://example.invalid/ai",
      recurrence_type: "weekly",
      recurrence_interval: 2,
    });
  });

  it("cancels and confirms destructive actions explicitly and denies other owners", async () => {
    let workspace = await ctx.run("create_task", { title: "刪除邊界" });
    const task = workspace.tasks.find((item) => item.title === "刪除邊界")!;
    let state = await ctx.runAI("create_conversation", { title: "刪除" });
    const conversationId = state.conversations[0].id;
    state = await ctx.runAI("create_pending_action", {
      conversation_id: conversationId,
      action_type: "delete_task",
      label: "刪除邊界",
      action_payload: { id: task.id },
    });
    const cancelled = state.pending_actions.find(
      (item) => item.status === "pending",
    )!;
    await ctx.runAI("resolve_action", { id: cancelled.id, confirm: false });
    expect(
      (await ctx.run("load")).tasks.some((item) => item.id === task.id),
    ).toBe(true);

    state = await ctx.runAI("create_pending_action", {
      conversation_id: conversationId,
      action_type: "delete_task",
      label: "刪除邊界",
      action_payload: { id: task.id },
    });
    const pending = state.pending_actions.find(
      (item) => item.status === "pending",
    )!;
    await ctx.runAI("resolve_action", { id: pending.id, confirm: true });
    expect(
      (await ctx.run("load")).tasks.some((item) => item.id === task.id),
    ).toBe(false);
    await expect(ctx.runAI("load", {}, bob)).rejects.toThrow(/尚未獲准/);

    await ctx.db.query("insert into public.allowed_users values($1)", [bob]);
    const bobState = await ctx.runAI("load", {}, bob);
    expect((bobState as AIState).conversations).toEqual([]);
  });
});
