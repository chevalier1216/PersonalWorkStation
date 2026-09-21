import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";

const baseMigrations = [
  "202609190001_board.sql",
  "202609200001_task_details.sql",
  "202609200002_today_recurring.sql",
  "202609200003_m2_constraints.sql",
  "202609200004_google_calendar.sql",
];

const rolloutMigrations = [
  "202609200005_ai_chat.sql",
  "202609210001_restore_task_details_command.sql",
  "202609210002_ai_summary_search.sql",
  "202609210003_attachments_maintenance.sql",
  "202609210004_attachment_storage_bucket.sql",
];

async function migration(name: string) {
  return readFile(
    new URL(`../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  );
}

async function productionBaseline() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key);
    create table storage.buckets(id text primary key, name text not null, public boolean not null default false);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
    create function auth.uid() returns uuid language sql stable
      as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function storage.foldername(text) returns text[] language sql immutable
      as $$select string_to_array($1,'/')$$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    grant usage on schema storage to authenticated,anon;
  `);
  for (const name of baseMigrations) await db.exec(await migration(name));

  // Production already contains this M3 command wrapper even though the M4
  // tables are absent. Recreate that exact precondition before the rollout.
  await db.exec(
    await migration("202609210001_restore_task_details_command.sql"),
  );
  return db;
}

const opened: PGlite[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.close()));
});

describe("M4-M6 production rollout", () => {
  it("applies the production migration order atomically from the audited M3 baseline", async () => {
    const db = await productionBaseline();
    opened.push(db);

    await db.transaction(async (tx) => {
      for (const name of rolloutMigrations)
        await tx.exec(await migration(name));
    });

    const result = await db.query<{
      kind: string;
      name: string;
      passed: boolean;
    }>(
      await readFile(
        new URL(
          "../supabase/verification/m4_m6_postflight.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );

    expect(result.rows).toHaveLength(33);
    expect(result.rows.every((row) => row.passed)).toBe(true);
  });

  it("rolls back every M4-M6 schema change when the transaction fails", async () => {
    const db = await productionBaseline();
    opened.push(db);

    await expect(
      db.transaction(async (tx) => {
        for (const name of rolloutMigrations)
          await tx.exec(await migration(name));
        await tx.exec("select public.rollout_failure_sentinel()");
      }),
    ).rejects.toThrow();

    const result = await db.query<{
      schema_present: boolean;
      bucket_present: boolean;
    }>(`
      select
        to_regclass('public.ai_conversations') is not null as schema_present,
        exists(select 1 from storage.buckets where id='pws-attachments') as bucket_present
    `);
    expect(result.rows[0]).toEqual({
      schema_present: false,
      bucket_present: false,
    });
  });
});
