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
  it("creates exactly one recurring task with the specified copied fields", async () => {
    let s = await ctx.run("create_task", { title: "Daily review" });
    const source = s.tasks.find((task) => task.title === "Daily review")!;
    s = await ctx.run("edit_task", {
      id: source.id,
      title: source.title,
      description: "Repeatable work",
      priority: "High",
      due_at: "2026-09-20T08:00:00.000Z",
      start_date: "2026-09-20",
      estimated_minutes: 30,
      deliverable_type: "Document",
      deliverable_value: "must not copy",
      recurrence_type: "daily",
      recurrence_interval: 1,
      recurrence_unit: null,
    });
    await ctx.run("add_tag", {
      task_id: source.id,
      name: "repeat",
      color: "#7895b2",
    });
    await ctx.run("add_checklist", {
      task_id: source.id,
      title: "Review inbox",
      due_date: "2026-09-20",
    });
    await ctx.run("add_note", { task_id: source.id, content: "do not copy" });
    const done = s.columns.find((column) => column.kind === "done")!;
    s = await ctx.run("move_task", { id: source.id, column_id: done.id });
    const next = s.tasks.find((task) => task.recurrence_source_id === source.id)!;
    expect(next).toMatchObject({
      title: "Daily review",
      description: "Repeatable work",
      priority: "High",
      start_date: "2026-09-21",
      recurrence_type: "daily",
      deliverable_type: null,
      deliverable_value: null,
    });
    expect(s.tags.some((tag) => tag.task_id === next.id && tag.name === "repeat")).toBe(true);
    expect(s.checklist.find((item) => item.task_id === next.id)).toMatchObject({
      title: "Review inbox",
      completed: false,
      due_date: "2026-09-21",
    });
    expect(s.notes.some((note) => note.task_id === next.id)).toBe(false);
    expect(s.notifications.some((item) => item.type === "recurring_created" && item.task_id === next.id)).toBe(true);
    await ctx.run("move_task", { id: source.id, column_id: done.id });
    s = await ctx.run("load");
    expect(s.tasks.filter((task) => task.recurrence_source_id === source.id)).toHaveLength(1);
    s = await ctx.run("delete_task", { id: source.id });
    expect(s.tasks.find((task) => task.id === next.id)).toMatchObject({ recurrence_source_id: null });
    const survivingOwner = await ctx.db.query<{ owner_id: string }>(
      "select owner_id::text from public.tasks where id=$1",
      [next.id],
    );
    expect(survivingOwner.rows[0].owner_id).toBe(alice);
  });
  it("notifies when a prerequisite completes and deduplicates the 15:00 reminder", async () => {
    let s = await ctx.run("create_task", { title: "M2 prerequisite" });
    const prerequisite = s.tasks.find((task) => task.title === "M2 prerequisite")!;
    s = await ctx.run("create_task", { title: "M2 dependent" });
    const dependent = s.tasks.find((task) => task.title === "M2 dependent")!;
    await ctx.run("add_relation", {
      task_id: dependent.id,
      related_task_id: prerequisite.id,
      relation_type: "prerequisite",
    });
    const done = s.columns.find((column) => column.kind === "done")!;
    s = await ctx.run("move_task", { id: prerequisite.id, column_id: done.id });
    expect(s.notifications.some((item) => item.type === "task_unblocked" && item.task_id === dependent.id)).toBe(true);
    s = await ctx.run("edit_task", {
      id: dependent.id,
      title: dependent.title,
      description: "",
      priority: "Urgent",
      due_at: null,
      start_date: null,
      estimated_minutes: null,
      deliverable_type: null,
      deliverable_value: null,
      recurrence_type: null,
      recurrence_interval: null,
      recurrence_unit: null,
    });
    await ctx.db.query(
      "select public.create_unscheduled_reminder($1,$2::timestamptz)",
      [alice, "2026-09-20T07:00:00.000Z"],
    );
    await ctx.db.query(
      "select public.create_unscheduled_reminder($1,$2::timestamptz)",
      [alice, "2026-09-20T08:00:00.000Z"],
    );
    s = await ctx.run("load");
    expect(s.notifications.filter((item) => item.dedupe_key === "unscheduled:2026-09-20")).toHaveLength(1);
    s = await ctx.run("save_today_preferences", {
      module_order: ["notifications", "tasks", "holidays"],
      hidden_modules: ["holidays"],
    });
    expect(s.preferences).toMatchObject({
      module_order: ["notifications", "tasks", "holidays"],
      hidden_modules: ["holidays"],
    });
    s = await ctx.run("mark_all_notifications_read");
    expect(s.notifications.every((item) => item.read_at)).toBe(true);
  });
  it("replaces official calendar data atomically and reports refresh failures", async () => {
    const before = await ctx.db.query<{ count: number }>(
      "select count(*)::integer as count from public.calendar_days where extract(year from day)=2026",
    );
    await expect(
      ctx.db.query("select public.replace_calendar_days(2026,'[]'::jsonb)"),
    ).rejects.toThrow(/incomplete/);
    const preserved = await ctx.db.query<{ count: number }>(
      "select count(*)::integer as count from public.calendar_days where extract(year from day)=2026",
    );
    expect(preserved.rows[0].count).toBe(before.rows[0].count);
    const replaced = await ctx.db.query<{ count: number }>(`select public.replace_calendar_days(2026,
      (select jsonb_agg(jsonb_build_object('region',region,'day',day,'day_type',day_type,'name',name,'source_url',source_url))
       from public.calendar_days where extract(year from day)=2026)) as count`);
    expect(replaced.rows[0].count).toBe(before.rows[0].count);
    await ctx.db.query("select public.record_calendar_sync_failure('official source unavailable')");
    const snapshot = await ctx.run("load");
    expect(snapshot.notifications.some((item) => item.type === "calendar_failure")).toBe(true);
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
      notifications: [],
      preferences: {
        module_order: ["tasks", "notifications", "holidays"],
        hidden_modules: [],
        updated_at: "",
      },
      calendar_days: [],
    });
  });
});
