import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { database, alice, bob } from "./database";
import { taskInput } from "../src/domain";
import { normalizeSnapshot } from "../src/api";
describe("PostgreSQL board boundaries", () => {
  let ctx: Awaited<ReturnType<typeof database>>;
  beforeAll(async () => {
    ctx = await database();
  }, 30000);
  afterAll(async () => {
    await ctx.db.close();
  });
  it("bootstraps once and persists task transitions and original history", async () => {
    let s = await ctx.run("load");
    expect(s.columns).toHaveLength(3);
    s = await ctx.run("create_task", { title: "Ship the board" });
    const task = s.tasks[0];
    expect(task.priority).toBe("Regular");
    const doing = s.columns.find((c) => c.kind === "doing")!,
      done = s.columns.find((c) => c.kind === "done")!;
    await ctx.run("move_task", { id: task.id, column_id: doing.id });
    s = await ctx.run("load");
    expect(s.tasks[0].column_id).toBe(doing.id);
    s = await ctx.run("move_task", { id: task.id, column_id: done.id });
    expect(s.tasks[0].completed_at).toBeTruthy();
    const completed = s.tasks[0].completed_at;
    s = await ctx.run("edit_task", {
      id: task.id,
      title: "Shipped",
      priority: "High",
    });
    expect(s.tasks[0].completed_at).toBe(completed);
    const h = await ctx.db.query<{ to_kind: string }>(
      "select to_kind from task_status_history where task_id=$1 order by changed_at",
      [task.id],
    );
    expect(h.rows.map((r) => r.to_kind)).toEqual(["todo", "doing", "done"]);
    s = await ctx.run("move_task", { id: task.id, column_id: doing.id });
    expect(s.tasks[0].completed_at).toBeNull();
  });
  it("denies unapproved users, cross-owner writes, and direct table mutation", async () => {
    await expect(ctx.run("load", {}, bob)).rejects.toThrow(/尚未獲准/);
    await ctx.db.query("insert into allowed_users values($1)", [bob]);
    const a = await ctx.run("load"),
      b = await ctx.run("load", {}, bob);
    expect(b.tasks).toHaveLength(0);
    await expect(
      ctx.run("delete_task", { id: a.tasks[0].id }, bob),
    ).rejects.toThrow(/找不到任務/);
    await expect(
      ctx.run("move_task", { id: a.tasks[0].id, column_id: b.columns[0].id }),
    ).rejects.toThrow(/目標欄位/);
    await ctx.db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        bob,
      ]);
      await tx.exec("set local role authenticated");
      const r = await tx.query("select * from tasks");
      expect(r.rows).toHaveLength(0);
    });
    await expect(
      ctx.db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          alice,
        ]);
        await tx.exec("set local role authenticated");
        await tx.exec("update tasks set title='tampered'");
      }),
    ).rejects.toThrow(/permission denied/);
  });
  it("preserves semantic columns and atomically migrates tasks to a replacement", async () => {
    let s = await ctx.run("load");
    const doing = s.columns.find((c) => c.kind === "doing")!,
      done = s.columns.find((c) => c.kind === "done")!;
    await expect(
      ctx.run("delete_column", { id: doing.id, replacement_id: done.id }),
    ).rejects.toThrow(/相同狀態/);
    s = await ctx.run("create_column", { title: "Review", kind: "doing" });
    const review = s.columns.find((c) => c.title === "Review")!;
    s = await ctx.run("delete_column", {
      id: doing.id,
      replacement_id: review.id,
    });
    expect(s.columns.some((c) => c.id === doing.id)).toBe(false);
    expect(s.tasks[0].column_id).toBe(review.id);
    const h = await ctx.db.query("select * from task_status_history");
    expect(h.rows).toHaveLength(4);
    s = await ctx.run("rename_column", {
      id: review.id,
      title: "Review ready",
    });
    expect(s.columns.find((c) => c.id === review.id)?.title).toBe(
      "Review ready",
    );
    s = await ctx.run("move_column", { id: review.id, position: 0 });
    expect(s.columns[0].id).toBe(review.id);
  });
  it("rejects invalid input without partial changes; orders and deletes tasks", async () => {
    expect(
      taskInput.safeParse({
        title: " ",
        description: "",
        priority: "Regular",
        due_at: null,
      }).success,
    ).toBe(false);
    const before = await ctx.run("load");
    await expect(ctx.run("create_task", { title: " " })).rejects.toThrow();
    expect((await ctx.run("load")).tasks).toHaveLength(before.tasks.length);
    let s = await ctx.run("create_task", { title: "One" });
    s = await ctx.run("create_task", { title: "Two" });
    const one = s.tasks.find((t) => t.title === "One")!,
      two = s.tasks.find((t) => t.title === "Two")!;
    s = await ctx.run("move_task", {
      id: two.id,
      column_id: one.column_id,
      position: 0,
    });
    expect(
      s.tasks.filter((t) => t.column_id === one.column_id).map((t) => t.title),
    ).toEqual(["Two", "One"]);
    s = await ctx.run("delete_task", { id: two.id });
    expect(s.tasks.some((t) => t.id === two.id)).toBe(false);
  });
  it("persists task details, child records, relations, and cascades ownership", async () => {
    let s = await ctx.run("load");
    const first = s.tasks[0];
    s = await ctx.run("create_task", { title: "Related task" });
    const related = s.tasks.find((task) => task.title === "Related task")!;
    s = await ctx.run("edit_task", {
      id: first.id,
      title: first.title,
      description: "Detail body",
      priority: "Urgent",
      due_at: "2026-09-22T08:00:00.000Z",
      start_date: "2026-09-20",
      estimated_minutes: 90,
      deliverable_type: "PR",
      deliverable_value: "https://example.invalid/pr/1",
    });
    expect(s.tasks.find((task) => task.id === first.id)).toMatchObject({
      start_date: "2026-09-20",
      estimated_minutes: 90,
      deliverable_type: "PR",
    });
    s = await ctx.run("add_tag", {
      task_id: first.id,
      name: "M1",
      color: "#7895b2",
    });
    s = await ctx.run("add_checklist", {
      task_id: first.id,
      title: "Verify",
      due_date: "2026-09-21",
    });
    s = await ctx.run("add_note", {
      task_id: first.id,
      content: "Decision retained",
    });
    s = await ctx.run("add_relation", {
      task_id: first.id,
      related_task_id: related.id,
      relation_type: "prerequisite",
    });
    expect(s.tags).toHaveLength(1);
    expect(s.checklist[0]).toMatchObject({ title: "Verify", completed: false });
    expect(s.notes[0].content).toBe("Decision retained");
    expect(s.relations[0]).toMatchObject({ related_task_id: related.id });
    s = await ctx.run("toggle_checklist", {
      id: s.checklist[0].id,
      completed: true,
    });
    expect(s.checklist[0].completed).toBe(true);
    await expect(
      ctx.run(
        "add_tag",
        { task_id: first.id, name: "leak", color: "#123456" },
        bob,
      ),
    ).rejects.toThrow(/找不到任務/);
    s = await ctx.run("delete_task", { id: related.id });
    expect(s.relations).toHaveLength(0);
  });
});

describe("snapshot compatibility", () => {
  it("keeps the v1 hosted snapshot usable before the additive migration", () => {
    expect(normalizeSnapshot({ columns: [], tasks: [] })).toEqual({
      columns: [],
      tasks: [],
      tags: [],
      checklist: [],
      notes: [],
      relations: [],
      history: [],
    });
  });
});
