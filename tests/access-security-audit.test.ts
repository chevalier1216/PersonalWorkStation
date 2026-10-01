import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

describe("Approved user security boundaries", () => {
  it("keeps attachment Storage private to the authenticated user prefix", async () => {
    const sql = await read(
      "supabase/migrations/202609210004_attachment_storage_bucket.sql",
    );
    for (const operation of ["insert", "select", "delete"])
      expect(sql).toMatch(new RegExp(`for ${operation} to authenticated`));
    expect(
      sql.match(/\(storage\.foldername\(name\)\)\[1\]=auth\.uid\(\)::text/g),
    ).toHaveLength(3);
    expect(sql.match(/public\.is_allowed\(\)/g)).toHaveLength(3);
    expect(sql).toContain("public=false");
  });

  it("uses the caller JWT and caller-provided Google token in user Drive functions", async () => {
    for (const path of [
      "supabase/functions/drive-archive/index.ts",
      "supabase/functions/drive-maintenance/index.ts",
    ]) {
      const source = await read(path);
      expect(source).toContain("Authorization: authorization");
      expect(source).toContain("client.auth.getUser()");
      expect(source).toContain("google_access_token");
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("limits service-role functions to shared reference data protected by a scheduler secret", async () => {
    const holidays = await read("supabase/functions/refresh-holidays/index.ts");
    const rates = await read(
      "supabase/functions/refresh-exchange-rates/index.ts",
    );
    expect(holidays).toContain("HOLIDAY_SYNC_SECRET");
    expect(holidays).not.toContain("google_access_token");
    expect(rates).not.toContain("google_access_token");
    expect(rates).not.toMatch(
      /\.from\(["'](?:tasks|task_attachments|workflow_runs|google_calendars)["']\)/,
    );
  });
});
