import { describe, expect, it } from "vitest";
import {
  archiveDirectory,
  driveFileMetadata,
  driveFolderQuery,
  hasForbiddenBackupKey,
  backupFilename,
  maintenanceDirectory,
} from "../supabase/functions/drive-archive/request";

describe("Google Drive archive request contract", () => {
  it("uses the authoritative directory and escapes folder queries", () => {
    expect(archiveDirectory(new Date("2026-09-21T12:00:00Z"))).toEqual([
      "PersonalWorkStation",
      "Attachments",
      "2026",
      "09",
    ]);
    expect(driveFolderQuery("Phil's files", "parent-1")).toContain(
      "name='Phil\\'s files'",
    );
    expect(driveFolderQuery("Folder", "parent-1")).toContain(
      "'parent-1' in parents",
    );
  });

  it("tags Drive files with the source attachment id", () => {
    expect(
      driveFileMetadata("evidence.pdf", "folder-1", "attachment-1"),
    ).toEqual({
      name: "evidence.pdf",
      parents: ["folder-1"],
      appProperties: {
        product: "PersonalWorkStation",
        attachmentId: "attachment-1",
      },
    });
  });

  it("builds dated backup paths and rejects secret field names only", () => {
    const date = new Date("2026-09-21T12:34:56Z");
    expect(maintenanceDirectory(date)).toEqual([
      "PersonalWorkStation",
      "Exports",
      "2026",
      "09",
    ]);
    expect(backupFilename(date)).toMatch(/^metadata-index-2026-09-21-/);
    expect(
      hasForbiddenBackupKey({
        notes: [{ content: "rotate access_token soon" }],
      }),
    ).toBe(false);
    expect(hasForbiddenBackupKey({ oauth: { access_token: "secret" } })).toBe(
      true,
    );
  });
});
