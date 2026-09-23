import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { Snapshot } from "../src/domain";
import type { SummaryState } from "../src/summary";
import type { SearchField, SearchResult } from "../src/search";
import type { AttachmentState } from "../src/attachments";
import type { WorkflowState } from "../src/workflow";
export const alice = "00000000-0000-4000-8000-000000000001";
export const bob = "00000000-0000-4000-8000-000000000002";
export async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${alice}'),('${bob}');`);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/202609190001_board.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609200001_task_details.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609200002_today_recurring.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609200003_m2_constraints.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609200004_google_calendar.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609210001_restore_task_details_command.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609210002_ai_summary_search.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609210003_attachments_maintenance.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609220001_workflow_execution_center.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609220002_priority_reminders.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609230001_exchange_rates.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609230002_today_preferences_module_guard.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into public.allowed_users values($1)", [alice]);
  async function run(
    action: string,
    payload: Record<string, unknown> = {},
    user = alice,
  ) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
      await tx.exec("set local role authenticated");
      const result = await tx.query<{ result: Snapshot }>(
        "select public.workspace_command($1,$2::jsonb) as result",
        [action, JSON.stringify(payload)],
      );
      return result.rows[0].result;
    });
  }
  async function runSummary(
    action: string,
    payload: Record<string, unknown> = {},
    user = alice,
  ) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
      await tx.exec("set local role authenticated");
      const result = await tx.query<{ result: SummaryState }>(
        "select public.summary_command($1,$2::jsonb) as result",
        [action, JSON.stringify(payload)],
      );
      return result.rows[0].result;
    });
  }
  async function search(query: string, field: SearchField, user = alice) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
      await tx.exec("set local role authenticated");
      const result = await tx.query<{ result: SearchResult[] }>(
        "select public.history_search($1,$2) as result",
        [query, field],
      );
      return result.rows[0].result;
    });
  }
  async function runAttachment(
    action: string,
    payload: Record<string, unknown> = {},
    user = alice,
  ) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
      await tx.exec("set local role authenticated");
      const result = await tx.query<{ result: AttachmentState }>(
        "select public.attachment_command($1,$2::jsonb) as result",
        [action, JSON.stringify(payload)],
      );
      return result.rows[0].result;
    });
  }
  async function searchArchive(query: string, user = alice) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
      await tx.exec("set local role authenticated");
      const result = await tx.query<{ result: SearchResult[] }>(
        "select public.archive_search($1) as result",
        [query],
      );
      return result.rows[0].result;
    });
  }
  async function runWorkflow(
    action: string,
    payload: Record<string, unknown> = {},
    user = alice,
  ) {
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
      await tx.exec("set local role authenticated");
      const result = await tx.query<{ result: WorkflowState }>(
        "select public.workflow_command($1,$2::jsonb) as result",
        [action, JSON.stringify(payload)],
      );
      return result.rows[0].result;
    });
  }
  return {
    db,
    run,
    runSummary,
    search,
    runAttachment,
    searchArchive,
    runWorkflow,
  };
}
