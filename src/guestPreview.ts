import type { CalendarOperations, Execute } from "./Board";
import type { Snapshot, Task } from "./domain";
import type {
  ExchangeRateOperations,
  ExchangeRateState,
} from "./exchangeRates";
import type { SearchField, SearchOperations, SearchResult } from "./search";
import type { SummaryOperations, SummaryState } from "./summary";
import type { WorkflowOperations, WorkflowState } from "./workflow";

type PreviewState = {
  snapshot: Snapshot;
  summaries: SummaryState;
  workflows: WorkflowState;
};

type PreviewStorage = Pick<Storage, "getItem" | "setItem">;

const storageKey = "personal-workstation:guest-preview:v1";
const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const clone = <T>(value: T): T => structuredClone(value);
const dateKey = (offset: number) => {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
};

function initialState(): PreviewState {
  const now = nowIso();
  const todo = "guest-column-todo";
  const doing = "guest-column-doing";
  const done = "guest-column-done";
  const taskA = "guest-task-plan";
  const taskB = "guest-task-review";
  const taskC = "guest-task-done";
  const runId = "guest-run-1";
  return {
    snapshot: {
      columns: [
        { id: todo, title: "待辦", kind: "todo", position: 0 },
        { id: doing, title: "進行中", kind: "doing", position: 1 },
        { id: done, title: "已完成", kind: "done", position: 2 },
      ],
      tasks: [
        {
          id: taskA,
          column_id: todo,
          title: "整理本週優先事項",
          description: "這是 Guest Preview 的隔離展示資料。",
          priority: "High",
          due_at: `${dateKey(0)}T09:30:00.000Z`,
          start_date: dateKey(0),
          estimated_minutes: 30,
          deliverable_type: null,
          deliverable_value: null,
          recurrence_type: null,
          recurrence_interval: null,
          recurrence_unit: null,
          recurrence_source_id: null,
          position: 0,
          completed_at: null,
          created_at: now,
        },
        {
          id: taskB,
          column_id: doing,
          title: "檢查行事曆與交付物",
          description: "可在展示模式編輯；資料只保留於目前分頁工作階段。",
          priority: "Regular",
          due_at: null,
          start_date: dateKey(1),
          estimated_minutes: 45,
          deliverable_type: "Document",
          deliverable_value: "Guest Preview",
          recurrence_type: null,
          recurrence_interval: null,
          recurrence_unit: null,
          recurrence_source_id: null,
          position: 0,
          completed_at: null,
          created_at: now,
        },
        {
          id: taskC,
          column_id: done,
          title: "完成展示資料隔離檢查",
          description: "沒有讀取或寫入任何 Supabase 使用者資料。",
          priority: "Urgent",
          due_at: null,
          start_date: dateKey(-1),
          estimated_minutes: 20,
          deliverable_type: "Test Result",
          deliverable_value: "PASS",
          recurrence_type: null,
          recurrence_interval: null,
          recurrence_unit: null,
          recurrence_source_id: null,
          position: 0,
          completed_at: now,
          created_at: now,
        },
      ],
      tags: [
        {
          id: "guest-tag-1",
          task_id: taskA,
          name: "展示資料",
          color: "#7895b2",
        },
      ],
      checklist: [
        {
          id: "guest-check-1",
          task_id: taskA,
          title: "確認今日任務",
          completed: false,
          due_date: dateKey(0),
          position: 0,
        },
      ],
      notes: [
        {
          id: "guest-note-1",
          task_id: taskB,
          content: "Guest Preview 不會連線到私人資料表。",
          created_at: now,
        },
      ],
      relations: [],
      history: [],
      notifications: [
        {
          id: "guest-notification-1",
          type: "system",
          title: "目前為 Guest Preview",
          body: "登入經管理員核准的 Google 帳號後，才會載入個人工作資料。",
          task_id: null,
          dedupe_key: "guest-preview",
          read_at: null,
          created_at: now,
        },
      ],
      preferences: {
        module_order: [
          "tasks",
          "calendar",
          "ai_execution",
          "notifications",
          "holidays",
          "exchange_rates",
        ],
        hidden_modules: [],
        updated_at: now,
      },
      calendar_days: [],
      google_calendars: [
        {
          calendar_id: "guest-calendar",
          summary: "展示行事曆",
          color: "#7895b2",
          time_zone: "Asia/Taipei",
          is_primary: true,
          selected: true,
          updated_at: now,
        },
      ],
      google_events: [
        {
          calendar_id: "guest-calendar",
          event_id: "guest-event-1",
          title: "專案進度檢查（展示）",
          start_at: `${dateKey(0)}T06:00:00.000Z`,
          end_at: `${dateKey(0)}T06:30:00.000Z`,
          start_date: null,
          end_date: null,
          all_day: false,
          html_link: "",
          status: "confirmed",
          updated_at: now,
        },
      ],
      task_calendar_links: [],
      google_calendar_sync: {
        last_attempt_at: now,
        last_success_at: now,
        last_error: "",
      },
    },
    summaries: {
      summaries: [
        {
          id: "guest-summary-1",
          task_id: taskC,
          previous_summary_id: null,
          latest_summary_id: null,
          version_label: "v1",
          title: "Guest Preview 隔離摘要",
          decisions: ["展示資料只存在目前瀏覽器工作階段"],
          completed: ["確認不使用 Supabase 使用者資料"],
          cancelled: [],
          superseded: [],
          content: "這份摘要僅供展示。",
          created_at: now,
        },
      ],
    },
    workflows: {
      runs: [
        {
          id: runId,
          run_code: "RUN-GUEST-001",
          task_id: taskC,
          title: "Guest isolation verification",
          source: "Guest Preview",
          project: "PersonalWorkStation",
          status: "success",
          started_at: now,
          finished_at: now,
          current_node_id: "guest-node-1",
          executor: "展示執行器",
          retry_count: 0,
          error: "",
          human_required: false,
          output: "展示隔離驗證完成",
          pause_reason: "",
          created_at: now,
          updated_at: now,
        },
      ],
      nodes: [
        {
          id: "guest-node-1",
          run_id: runId,
          node_key: "verification",
          name: "Verification",
          type: "test",
          status: "success",
          position: 0,
          started_at: now,
          finished_at: now,
          input: {},
          output: { message: "Guest data is isolated" },
          error: "",
          retry_count: 0,
          tool: "guest-preview",
          verification: { passed: true },
          parent_node_id: null,
          required: true,
          created_at: now,
          updated_at: now,
        },
      ],
      events: [],
      logs: [],
      artifacts: [],
      human_gates: [],
    },
  };
}

function readState(storage?: PreviewStorage): PreviewState {
  if (!storage) return initialState();
  try {
    const saved = storage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as PreviewState) : initialState();
  } catch {
    return initialState();
  }
}

export function createGuestWorkspace(
  storage: PreviewStorage | undefined = typeof window === "undefined"
    ? undefined
    : window.sessionStorage,
  signIn: () => Promise<void> = async () => undefined,
) {
  let state = readState(storage);
  const save = () => storage?.setItem(storageKey, JSON.stringify(state));
  const snapshot = () => clone(state.snapshot);
  const findTask = (taskId: unknown) =>
    state.snapshot.tasks.find((task) => task.id === taskId);

  const execute: Execute = async (action, payload = {}) => {
    const current = state.snapshot;
    const timestamp = nowIso();
    if (action === "load") return snapshot();
    if (action === "create_task") {
      const column = current.columns.find((item) => item.kind === "todo");
      if (!column) throw new Error("展示看板缺少待辦欄位");
      current.tasks.push({
        id: id("guest-task"),
        column_id: column.id,
        title: String(payload.title ?? "").trim(),
        description: String(payload.description ?? ""),
        priority: (payload.priority as Task["priority"]) ?? "Regular",
        due_at: (payload.due_at as string | null) ?? null,
        start_date: (payload.start_date as string | null) ?? null,
        estimated_minutes: (payload.estimated_minutes as number | null) ?? null,
        deliverable_type: (payload.deliverable_type as string | null) ?? null,
        deliverable_value: (payload.deliverable_value as string | null) ?? null,
        recurrence_type:
          (payload.recurrence_type as Task["recurrence_type"]) ?? null,
        recurrence_interval:
          (payload.recurrence_interval as number | null) ?? null,
        recurrence_unit:
          (payload.recurrence_unit as Task["recurrence_unit"]) ?? null,
        recurrence_source_id: null,
        position: current.tasks.filter((task) => task.column_id === column.id)
          .length,
        completed_at: null,
        created_at: timestamp,
      });
    } else if (action === "edit_task") {
      const task = findTask(payload.id);
      if (!task) throw new Error("找不到展示任務");
      for (const key of [
        "title",
        "description",
        "priority",
        "due_at",
        "start_date",
        "estimated_minutes",
        "deliverable_type",
        "deliverable_value",
        "recurrence_type",
        "recurrence_interval",
        "recurrence_unit",
      ] as const)
        if (key in payload) Object.assign(task, { [key]: payload[key] });
    } else if (action === "delete_task") {
      const taskId = String(payload.id);
      current.tasks = current.tasks.filter((task) => task.id !== taskId);
      current.tags = current.tags.filter((item) => item.task_id !== taskId);
      current.checklist = current.checklist.filter(
        (item) => item.task_id !== taskId,
      );
      current.notes = current.notes.filter((item) => item.task_id !== taskId);
      current.relations = current.relations.filter(
        (item) => item.task_id !== taskId && item.related_task_id !== taskId,
      );
    } else if (action === "move_task") {
      const task = findTask(payload.id);
      const column = current.columns.find(
        (item) => item.id === payload.column_id,
      );
      if (!task || !column) throw new Error("找不到展示任務或欄位");
      const previous = current.columns.find(
        (item) => item.id === task.column_id,
      );
      task.column_id = column.id;
      task.position = Number(payload.position ?? 0);
      task.completed_at = column.kind === "done" ? timestamp : null;
      current.history.push({
        id: id("guest-history"),
        task_id: task.id,
        from_kind: previous?.kind ?? null,
        to_kind: column.kind,
        changed_at: timestamp,
      });
    } else if (action === "create_column") {
      current.columns.push({
        id: id("guest-column"),
        title: String(payload.title),
        kind: payload.kind as "todo" | "doing" | "done",
        position: current.columns.length,
      });
    } else if (action === "rename_column") {
      const column = current.columns.find((item) => item.id === payload.id);
      if (!column) throw new Error("找不到展示欄位");
      column.title = String(payload.title);
    } else if (action === "move_column") {
      const from = current.columns.findIndex((item) => item.id === payload.id);
      const to = Number(payload.position);
      if (from >= 0 && to >= 0) {
        const [column] = current.columns.splice(from, 1);
        current.columns.splice(to, 0, column);
        current.columns.forEach((item, index) => (item.position = index));
      }
    } else if (action === "delete_column") {
      const target = String(payload.id);
      const replacement = String(payload.replacement_id);
      current.tasks.forEach((task) => {
        if (task.column_id === target) task.column_id = replacement;
      });
      current.columns = current.columns.filter((item) => item.id !== target);
    } else if (action === "add_tag") {
      current.tags.push({
        id: id("guest-tag"),
        task_id: String(payload.task_id),
        name: String(payload.name),
        color: String(payload.color),
      });
    } else if (action === "remove_tag") {
      current.tags = current.tags.filter((item) => item.id !== payload.id);
    } else if (action === "add_checklist") {
      current.checklist.push({
        id: id("guest-check"),
        task_id: String(payload.task_id),
        title: String(payload.title),
        completed: false,
        due_date: (payload.due_date as string | null) ?? null,
        position: current.checklist.filter(
          (item) => item.task_id === payload.task_id,
        ).length,
      });
    } else if (action === "toggle_checklist") {
      const item = current.checklist.find(
        (candidate) => candidate.id === payload.id,
      );
      if (item) item.completed = Boolean(payload.completed);
    } else if (action === "delete_checklist") {
      current.checklist = current.checklist.filter(
        (item) => item.id !== payload.id,
      );
    } else if (action === "add_note") {
      current.notes.push({
        id: id("guest-note"),
        task_id: String(payload.task_id),
        content: String(payload.content),
        created_at: timestamp,
      });
    } else if (action === "add_relation") {
      current.relations.push({
        id: id("guest-relation"),
        task_id: String(payload.task_id),
        related_task_id: String(payload.related_task_id),
        relation_type: payload.relation_type as
          | "prerequisite"
          | "follow_up"
          | "related",
        reason: String(payload.reason ?? ""),
      });
    } else if (action === "remove_relation") {
      current.relations = current.relations.filter(
        (item) => item.id !== payload.id,
      );
    } else if (action === "notification_read") {
      const item = current.notifications.find(
        (candidate) => candidate.id === payload.id,
      );
      if (item) item.read_at ??= timestamp;
    } else if (action === "notifications_read_all") {
      current.notifications.forEach((item) => (item.read_at ??= timestamp));
    } else if (action === "save_today_preferences") {
      current.preferences = {
        module_order:
          payload.module_order as Snapshot["preferences"]["module_order"],
        hidden_modules:
          payload.hidden_modules as Snapshot["preferences"]["hidden_modules"],
        updated_at: timestamp,
      };
    } else if (action === "calendar_set_selections") {
      const selected = new Set(payload.calendar_ids as string[]);
      current.google_calendars.forEach(
        (calendar) => (calendar.selected = selected.has(calendar.calendar_id)),
      );
    } else if (action === "create_summary_task") {
      const summary = state.summaries.summaries.find(
        (item) => item.id === payload.summary_id,
      );
      if (summary)
        return execute("create_task", {
          title: summary.title,
          description: summary.content,
          priority: "Regular",
        });
    } else {
      throw new Error(`Guest Preview 尚未支援操作：${action}`);
    }
    save();
    return snapshot();
  };

  const calendar: CalendarOperations = {
    tokenAvailable: false,
    connect: signIn,
    sync: async () => snapshot(),
    create: async () => {
      throw new Error("請先登入經核准的帳號，再連結個人的 Google Calendar。");
    },
    createStandalone: async () => {
      throw new Error("Guest Preview 不會連線個人的 Google Calendar。");
    },
  };

  const summaries: SummaryOperations = {
    load: async () => clone(state.summaries),
    create: async (taskId, draft) => {
      const previous = state.summaries.summaries.find(
        (item) => item.task_id === taskId,
      );
      state.summaries.summaries.unshift({
        id: id("guest-summary"),
        task_id: taskId,
        previous_summary_id: previous?.id ?? null,
        latest_summary_id: null,
        version_label: `v${state.summaries.summaries.filter((item) => item.task_id === taskId).length + 1}`,
        ...draft,
        created_at: nowIso(),
      });
      save();
      return clone(state.summaries);
    },
  };

  const search: SearchOperations = {
    search: async (query: string, field: SearchField) => {
      const needle = query.toLocaleLowerCase();
      const results: SearchResult[] = [];
      for (const task of state.snapshot.tasks) {
        const candidates: Array<[SearchField, string]> = [
          ["title", task.title],
          ["description", task.description],
          ["priority", task.priority],
          ["deliverable", task.deliverable_value ?? ""],
        ];
        const match = candidates.find(
          ([candidateField, value]) =>
            (field === "all" || field === candidateField) &&
            value.toLocaleLowerCase().includes(needle),
        );
        if (match)
          results.push({
            result_type: "task",
            matched_field: match[0],
            result_id: task.id,
            result_title: task.title,
            snippet: match[1],
            task_id: task.id,
            note_id: null,
            conversation_id: null,
            summary_id: null,
            occurred_at: task.created_at,
          });
      }
      return results;
    },
  };

  const workflows: WorkflowOperations = {
    run: async (action, payload = {}) => {
      if (action === "create_run") {
        const runId = id("guest-run");
        const timestamp = nowIso();
        state.workflows.runs.unshift({
          id: runId,
          run_code: `RUN-GUEST-${String(state.workflows.runs.length + 1).padStart(3, "0")}`,
          task_id: (payload.task_id as string | null) ?? null,
          title: String(payload.title ?? "展示 Run"),
          source: String(payload.source ?? "Guest Preview"),
          project: String(payload.project ?? "PersonalWorkStation"),
          status: "waiting_external",
          started_at: null,
          finished_at: null,
          current_node_id: null,
          executor: "展示模式",
          retry_count: 0,
          error: "",
          human_required: false,
          output: "",
          pause_reason: "",
          created_at: timestamp,
          updated_at: timestamp,
        });
        save();
      }
      return clone(state.workflows);
    },
  };

  const rateState: ExchangeRateState = {
    rates: [
      {
        currency: "USD",
        spot_buy: 31.6,
        spot_sell: 31.7,
        cash_buy: 31.35,
        cash_sell: 31.9,
        quoted_at: nowIso(),
        fetched_at: nowIso(),
        source_url: "https://www.esunbank.com/",
      },
      {
        currency: "CNY",
        spot_buy: 4.7,
        spot_sell: 4.75,
        cash_buy: 4.65,
        cash_sell: 4.81,
        quoted_at: nowIso(),
        fetched_at: nowIso(),
        source_url: "https://www.esunbank.com/",
      },
      {
        currency: "JPY",
        spot_buy: 0.199,
        spot_sell: 0.203,
        cash_buy: 0.198,
        cash_sell: 0.205,
        quoted_at: nowIso(),
        fetched_at: nowIso(),
        source_url: "https://www.esunbank.com/",
      },
      {
        currency: "EUR",
        spot_buy: 37.1,
        spot_sell: 37.5,
        cash_buy: 36.7,
        cash_sell: 37.9,
        quoted_at: nowIso(),
        fetched_at: nowIso(),
        source_url: "https://www.esunbank.com/",
      },
      {
        currency: "AUD",
        spot_buy: 20.8,
        spot_sell: 21.2,
        cash_buy: 20.3,
        cash_sell: 21.7,
        quoted_at: nowIso(),
        fetched_at: nowIso(),
        source_url: "https://www.esunbank.com/",
      },
    ],
    last_attempt_at: nowIso(),
    last_success_at: nowIso(),
    last_error: "",
  };
  const exchangeRates: ExchangeRateOperations = {
    load: async () => clone(rateState),
    refresh: async () => clone(rateState),
  };

  return { execute, calendar, summaries, search, workflows, exchangeRates };
}
