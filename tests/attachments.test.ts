import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { alice, bob, database } from "./database";
import {
  backupIsDue,
  capacityIsDue,
  type AttachmentState,
} from "../src/attachments";

describe("M6 attachment archive and maintenance", () => {
  let ctx: Awaited<ReturnType<typeof database>>;
  let taskId = "";
  let noteId = "";
  let attachmentId = "";

  beforeAll(async () => {
    ctx = await database();
    let workspace = await ctx.run("create_task", {
      title: "M6 Archive Source",
    });
    taskId = workspace.tasks.find(
      (item) => item.title === "M6 Archive Source",
    )!.id;
    workspace = await ctx.run("add_note", {
      task_id: taskId,
      content: "附件來源 Activity",
    });
    noteId = workspace.notes.find((item) => item.task_id === taskId)!.id;
  }, 30000);

  afterAll(async () => {
    await ctx.db.close();
  });

  it("links an attachment to the same Task Activity and keeps the source on failure", async () => {
    let state = await ctx.runAttachment("record_upload", {
      task_id: taskId,
      note_id: noteId,
      filename: "release evidence.pdf",
      mime_type: "application/pdf",
      size_bytes: 4096,
      source_storage_path: `${alice}/${taskId}/evidence.pdf`,
      metadata: { category: "evidence" },
    });
    const attachment = state.attachments[0];
    attachmentId = attachment.id;
    expect(attachment).toMatchObject({
      task_id: taskId,
      note_id: noteId,
      archive_status: "active",
      source_deleted_at: null,
    });

    await ctx.runAttachment("archive_start", { id: attachmentId });
    state = await ctx.runAttachment("archive_failure", {
      id: attachmentId,
      message: "Drive 暫時中斷",
    });
    expect(state.attachments[0]).toMatchObject({
      archive_status: "failed",
      source_deleted_at: null,
      archive_error: "Drive 暫時中斷",
    });
    const workspace = await ctx.run("load");
    expect(
      workspace.notifications.some(
        (item) => item.type === "archive_failure" && item.task_id === taskId,
      ),
    ).toBe(true);
  });

  it("deletes the source only after verified Drive metadata is persisted", async () => {
    await expect(
      ctx.runAttachment("archive_source_deleted", { id: attachmentId }),
    ).rejects.toThrow(/Drive 尚未驗證/);
    await ctx.runAttachment("archive_start", { id: attachmentId });
    let state = await ctx.runAttachment("archive_success", {
      id: attachmentId,
      drive_file_id: "drive-123",
      drive_web_view_link: "https://drive.google.com/open?id=drive-123",
      drive_path:
        "PersonalWorkStation/Attachments/2026/09/release evidence.pdf",
    });
    expect(state.attachments[0]).toMatchObject({
      archive_status: "archived",
      source_deleted_at: null,
      drive_file_id: "drive-123",
    });
    state = await ctx.runAttachment("archive_source_deleted", {
      id: attachmentId,
    });
    expect(state.attachments[0].source_deleted_at).toBeTruthy();
    expect((await ctx.searchArchive("release evidence"))[0]).toMatchObject({
      result_type: "attachment",
      task_id: taskId,
      note_id: noteId,
      attachment_id: attachmentId,
    });
  });

  it("claims an attachment once and never restarts one already archived", async () => {
    const state = await ctx.runAttachment("record_upload", {
      task_id: taskId,
      filename: "double-click.txt",
      mime_type: "text/plain",
      size_bytes: 12,
      source_storage_path: `${alice}/${taskId}/double-click.txt`,
    });
    const id = state.attachments[0].id;
    expect(await ctx.claimAttachment(id)).toBe(true);
    expect(await ctx.claimAttachment(id)).toBe(false);
    await ctx.runAttachment("archive_success", {
      id,
      drive_file_id: "drive-double-click",
      drive_web_view_link:
        "https://drive.google.com/open?id=drive-double-click",
      drive_path: "PersonalWorkStation/Attachments/2026/09/double-click.txt",
    });
    await ctx.runAttachment("archive_source_deleted", { id });
    expect(await ctx.claimAttachment(id)).toBe(false);
    expect(
      (await ctx.runAttachment("load")).attachments.find((a) => a.id === id),
    ).toMatchObject({ archive_status: "archived", archive_error: "" });
  });

  it("records capacity warnings and metadata backup outcomes without secrets", async () => {
    let state = await ctx.runAttachment("record_capacity", {
      service: "supabase_storage",
      used_bytes: 700,
      limit_bytes: 1000,
      used_percent: 70,
    });
    expect(state.capacity[0]).toMatchObject({
      service: "supabase_storage",
      used_percent: 70,
    });
    expect(
      (await ctx.run("load")).notifications.some((item) =>
        item.title.includes("儲存空間接近上限"),
      ),
    ).toBe(true);

    state = await ctx.runAttachment("record_backup", {
      status: "completed",
      drive_file_id: "backup-1",
      drive_web_view_link: "https://drive.google.com/open?id=backup-1",
      drive_path: "PersonalWorkStation/Exports/2026/09/index.json",
      record_count: 12,
    });
    expect(state.backups[0]).toMatchObject({
      status: "completed",
      record_count: 12,
    });
    expect(JSON.stringify(state.backups)).not.toMatch(/token|secret|key/i);
    expect(
      backupIsDue(state, new Date(state.backups[0].created_at).getTime()),
    ).toBe(false);
    expect(
      backupIsDue(
        state,
        new Date(state.backups[0].created_at).getTime() + 8 * 86400000,
      ),
    ).toBe(true);
  });

  it("treats a missing successful backup as due", () => {
    const state: AttachmentState = {
      attachments: [],
      capacity: [],
      backups: [],
    };
    expect(backupIsDue(state)).toBe(true);
    expect(capacityIsDue(state)).toBe(true);
  });

  it("enforces allowlist and owner isolation", async () => {
    await expect(ctx.runAttachment("load", {}, bob)).rejects.toThrow(
      /尚未獲准/,
    );
    await ctx.db.query("insert into public.allowed_users values($1)", [bob]);
    expect((await ctx.runAttachment("load", {}, bob)).attachments).toEqual([]);
    expect(await ctx.searchArchive("release", bob)).toEqual([]);
  });
});
