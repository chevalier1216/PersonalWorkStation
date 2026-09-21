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
import aiMigration from "../supabase/migrations/202609200005_ai_chat.sql?raw";
import taskDetailsCommandFix from "../supabase/migrations/202609210001_restore_task_details_command.sql?raw";
import m5Migration from "../supabase/migrations/202609210002_ai_summary_search.sql?raw";
import m6Migration from "../supabase/migrations/202609210003_attachments_maintenance.sql?raw";
import type { AIOperations, AIState } from "../src/ai";
import type { SummaryOperations, SummaryState } from "../src/summary";
import type { SearchField, SearchResult } from "../src/search";
import type { AttachmentOperations, AttachmentState } from "../src/attachments";
import "../src/style.css";
const db = new PGlite("idb://m4-browser-tests-v1");
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
const hasAI = await db.query<{ exists: boolean }>(
  "select exists(select 1 from pg_tables where schemaname='public' and tablename='ai_conversations')",
);
if (!hasAI.rows[0].exists) await db.exec(aiMigration);
const hasM3CommandCore = await db.query<{ exists: boolean }>(
  "select exists(select 1 from pg_proc where proname='workspace_command_core_m3')",
);
if (!hasM3CommandCore.rows[0].exists) await db.exec(taskDetailsCommandFix);
const hasM5 = await db.query<{ exists: boolean }>(
  "select exists(select 1 from pg_tables where schemaname='public' and tablename='ai_summaries')",
);
if (!hasM5.rows[0].exists) await db.exec(m5Migration);
const hasM6 = await db.query<{ exists: boolean }>(
  "select exists(select 1 from pg_tables where schemaname='public' and tablename='task_attachments')",
);
if (!hasM6.rows[0].exists) await db.exec(m6Migration);
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
const aiCommand = async (
  action: string,
  payload: Record<string, unknown> = {},
) => {
  const state = await db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    await tx.exec("set local role authenticated");
    const result = await tx.query<{ result: AIState }>(
      "select ai_command($1,$2::jsonb) as result",
      [action, JSON.stringify(payload)],
    );
    return result.rows[0].result;
  });
  await db.syncToFs();
  return state;
};
const ai: AIOperations = {
  load: () => aiCommand("load"),
  createConversation: (title) => aiCommand("create_conversation", { title }),
  resolve: (action, confirm) =>
    aiCommand("resolve_action", { id: action.id, confirm }),
  send: async (currentConversationId, message) => {
    let conversationId = currentConversationId;
    if (!conversationId) {
      const created = await aiCommand("create_conversation", {
        title: message.slice(0, 60),
      });
      conversationId = created.conversations[0].id;
    }
    await aiCommand("append_message", {
      conversation_id: conversationId,
      role: "user",
      content: message,
    });
    if (new URLSearchParams(location.search).get("aiFail") === "1") {
      await aiCommand("record_failure", {
        conversation_id: conversationId,
        message: "測試用 OpenAI 中斷",
      });
      throw new Error("測試用 OpenAI 中斷");
    }

    const snapshot = await execute("load");
    const createMatch = message.match(/^建立 Task：(.+)$/);
    const editMatch = message.match(/^修改 Task：(.+?) => (.+)$/);
    const deleteMatch = message.match(/^刪除 Task：(.+)$/);
    const calendarMatch = message.match(/^加入 Calendar：(.+)$/);
    let reply = "已收到。";
    if (createMatch) {
      await execute("create_task", { title: createMatch[1] });
      reply = `已建立 Task「${createMatch[1]}」。`;
    } else if (editMatch) {
      const task = snapshot.tasks.find((item) => item.title === editMatch[1]);
      if (!task) throw new Error("找不到測試 Task");
      await aiCommand("create_pending_action", {
        conversation_id: conversationId,
        action_type: "edit_task",
        label: `修改「${task.title}」`,
        action_payload: { id: task.id, changes: { title: editMatch[2] } },
      });
      reply = "已建立待確認修改。";
    } else if (deleteMatch) {
      const task = snapshot.tasks.find((item) => item.title === deleteMatch[1]);
      if (!task) throw new Error("找不到測試 Task");
      await aiCommand("create_pending_action", {
        conversation_id: conversationId,
        action_type: "delete_task",
        label: `刪除「${task.title}」`,
        action_payload: { id: task.id },
      });
      reply = "已建立待確認刪除。";
    } else if (calendarMatch) {
      const task = snapshot.tasks.find(
        (item) => item.title === calendarMatch[1],
      );
      if (!task) throw new Error("找不到測試 Task");
      await aiCommand("create_pending_action", {
        conversation_id: conversationId,
        action_type: "calendar_relation",
        label: `為「${task.title}」建立 Calendar event`,
        action_payload: { task_id: task.id, calendar_id: "primary@test" },
      });
      reply = "已建立待確認 Calendar relation。";
    }
    return aiCommand("append_message", {
      conversation_id: conversationId,
      role: "assistant",
      content: reply,
    });
  },
};
const summaryCommand = async (
  action: string,
  payload: Record<string, unknown> = {},
) => {
  const state = await db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    await tx.exec("set local role authenticated");
    const result = await tx.query<{ result: SummaryState }>(
      "select summary_command($1,$2::jsonb) as result",
      [action, JSON.stringify(payload)],
    );
    return result.rows[0].result;
  });
  await db.syncToFs();
  return state;
};
const summaries: SummaryOperations = {
  load: () => summaryCommand("load"),
  generate: async (taskId) => {
    if (new URLSearchParams(location.search).get("summaryFail") === "1") {
      await summaryCommand("record_failure", {
        task_id: taskId,
        message: "測試用 AI Summary 中斷",
      });
      throw new Error("測試用 AI Summary 中斷");
    }
    const current = await summaryCommand("load");
    const previous = current.summaries.find((item) => item.task_id === taskId);
    return summaryCommand("create", {
      task_id: taskId,
      title: previous ? "發佈準備與風險變更" : "發佈準備與驗證結果",
      decisions: previous ? ["改採分階段發布"] : ["先完成 production smoke"],
      completed: ["驗證 Task persistence"],
      cancelled: [],
      superseded: previous ? ["一次完成全部發布"] : [],
      content: previous
        ? "已完成持久化驗證，接下來依風險分階段發布。"
        : "已完成 Task persistence 驗證，待執行 production smoke。",
    });
  },
};
const search = async (query: string, field: SearchField) => {
  const history =
    field === "attachments"
      ? []
      : await db.transaction(async (tx) => {
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
            user,
          ]);
          await tx.exec("set local role authenticated");
          const result = await tx.query<{ result: SearchResult[] }>(
            "select history_search($1,$2) as result",
            [query, field],
          );
          return result.rows[0].result;
        });
  const archive =
    field === "all" || field === "attachments"
      ? await db.transaction(async (tx) => {
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
            user,
          ]);
          await tx.exec("set local role authenticated");
          const result = await tx.query<{ result: SearchResult[] }>(
            "select archive_search($1) as result",
            [query],
          );
          return result.rows[0].result;
        })
      : [];
  return [...history, ...archive].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );
};
const attachmentCommand = async (
  action: string,
  payload: Record<string, unknown> = {},
) => {
  const state = await db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    await tx.exec("set local role authenticated");
    const result = await tx.query<{ result: AttachmentState }>(
      "select attachment_command($1,$2::jsonb) as result",
      [action, JSON.stringify(payload)],
    );
    return result.rows[0].result;
  });
  await db.syncToFs();
  return state;
};
const attachments: AttachmentOperations = {
  load: () => attachmentCommand("load"),
  upload: (taskId, file, noteId) =>
    attachmentCommand("record_upload", {
      task_id: taskId,
      note_id: noteId ?? null,
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      source_storage_path: `${user}/${taskId}/${crypto.randomUUID()}-${file.name}`,
      metadata: { fixture: true },
    }),
  open: async (attachment) => {
    await attachmentCommand("mark_accessed", { id: attachment.id });
    return (
      attachment.drive_web_view_link ??
      `https://example.invalid/storage/${attachment.id}`
    );
  },
  archive: async (id) => {
    await attachmentCommand("archive_start", { id });
    if (new URLSearchParams(location.search).get("archiveFail") === "1") {
      await attachmentCommand("archive_failure", {
        id,
        message: "測試用 Drive 中斷",
      });
      throw new Error("測試用 Drive 中斷");
    }
    await attachmentCommand("archive_success", {
      id,
      drive_file_id: `drive-${id}`,
      drive_web_view_link: `https://drive.google.com/open?id=drive-${id}`,
      drive_path: "PersonalWorkStation/Attachments/2026/09/fixture",
    });
    await attachmentCommand("archive_source_deleted", { id });
    return attachmentCommand("load");
  },
  measure: async () => {
    await attachmentCommand("record_capacity", {
      service: "supabase_database",
      used_bytes: 12 * 1024 * 1024,
      limit_bytes: 500 * 1024 * 1024,
      used_percent: 2.4,
    });
    await attachmentCommand("record_capacity", {
      service: "supabase_storage",
      used_bytes: 100 * 1024 * 1024,
      limit_bytes: 1024 * 1024 * 1024,
      used_percent: 9.77,
    });
    return attachmentCommand("record_capacity", {
      service: "google_drive",
      used_bytes: 2 * 1024 * 1024 * 1024,
      limit_bytes: 15 * 1024 * 1024 * 1024,
      used_percent: 13.33,
    });
  },
  backup: () =>
    attachmentCommand("record_backup", {
      status: "completed",
      drive_file_id: `backup-${Date.now()}`,
      drive_web_view_link: "https://drive.google.com/open?id=backup-fixture",
      drive_path: "PersonalWorkStation/Exports/2026/09/metadata-index.json",
      record_count: 20,
    }),
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
              html_link:
                "https://calendar.google.com/calendar/event?eid=fixture",
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
    ai={ai}
    summaries={summaries}
    search={{ search }}
    attachments={attachments}
  />,
);
