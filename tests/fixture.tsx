// Test-only entry: excluded from the production Vite build. No Supabase/OAuth claim.
import { PGlite } from "@electric-sql/pglite";
import { createRoot } from "react-dom/client";
import { Board, type Execute } from "../src/Board";
import type { Snapshot } from "../src/domain";
import migration from "../supabase/migrations/202609190001_board.sql?raw";
import detailsMigration from "../supabase/migrations/202609200001_task_details.sql?raw";
import todayMigration from "../supabase/migrations/202609200002_today_recurring.sql?raw";
import m2ConstraintsMigration from "../supabase/migrations/202609200003_m2_constraints.sql?raw";
import calendarMigration from "../supabase/migrations/202609200004_google_calendar.sql?raw";
import "../src/style.css";
const db = new PGlite("idb://m3-browser-tests-v1");
await db.waitReady;
const exists = await db.query<{ exists: boolean }>(
  "select exists(select 1 from pg_tables where schemaname='public' and tablename='allowed_users')",
);
const user = "00000000-0000-4000-8000-000000000001";
if (!exists.rows[0].exists) {
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values ('${user}');`,
  );
  await db.exec(migration);
  await db.query("insert into allowed_users values($1)", [user]);
}
const hasDetails = await db.query<{ exists: boolean }>(
  "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='start_date')",
);
if (!hasDetails.rows[0].exists) await db.exec(detailsMigration);
const hasToday = await db.query<{ exists: boolean }>(
  "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='recurrence_type')",
);
if (!hasToday.rows[0].exists) await db.exec(todayMigration);
const hasM2Constraints = await db.query<{ exists: boolean }>(
  "select exists(select 1 from pg_constraint where conname='tasks_recurrence_source_fkey')",
);
if (!hasM2Constraints.rows[0].exists) await db.exec(m2ConstraintsMigration);
const hasCalendar = await db.query<{ exists: boolean }>(
  "select exists(select 1 from pg_tables where schemaname='public' and tablename='google_calendars')",
);
if (!hasCalendar.rows[0].exists) await db.exec(calendarMigration);
const execute: Execute = async (action, payload = {}) => {
  if (new URLSearchParams(location.search).get("fail") === action)
    throw new Error("測試用連線中斷");
  const snapshot = await db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    await tx.exec("set local role authenticated");
    const r = await tx.query<{ result: Snapshot }>(
      "select workspace_command($1,$2::jsonb) as result",
      [action, JSON.stringify(payload)],
    );
    return r.rows[0].result;
  });
  await db.syncToFs();
  return snapshot;
};
createRoot(document.getElementById("root")!).render(
  <Board
    execute={execute}
    calendar={{
      tokenAvailable: true,
      connect: async () => undefined,
      sync: async () => {
        const today = new Date();
        today.setHours(10, 0, 0, 0);
        const end = new Date(today.getTime() + 30 * 60000);
        return execute("calendar_sync_success", {
          calendars: [
            {
              id: "primary@test",
              summary: "個人行事曆",
              color: "#6f9ed6",
              time_zone: "Asia/Taipei",
              is_primary: true,
              selected: true,
            },
            {
              id: "work@test",
              summary: "工作",
              color: "#d69a6f",
              time_zone: "Asia/Taipei",
              is_primary: false,
              selected: false,
            },
          ],
          events: [
            {
              calendar_id: "primary@test",
              event_id: "fixture-event",
              title: "M3 行事曆事件",
              start_at: today.toISOString(),
              end_at: end.toISOString(),
              start_date: null,
              end_date: null,
              all_day: false,
              html_link: "https://calendar.google.com/calendar/event?eid=fixture",
              status: "confirmed",
            },
          ],
        });
      },
      create: async (task, calendarId) =>
        new URLSearchParams(location.search).get("calendarFail") === "1"
          ? execute("calendar_link_failure", {
              task_id: task.id,
              calendar_id: calendarId,
              message: "測試用 Google API 中斷",
            })
          : execute("calendar_link_success", {
              task_id: task.id,
              calendar_id: calendarId,
              event_id: `event-${task.id}`,
              html_link: "https://calendar.google.com/calendar/event?eid=task",
            }),
    }}
  />,
);
