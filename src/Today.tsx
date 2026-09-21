import { useMemo, useState } from "react";
import {
  priorityLabels,
  type CalendarDay,
  type Notification,
  type Snapshot,
  type Task,
} from "./domain";
import type { CalendarOperations } from "./Board";
import { AIChat } from "./AIChat";
import type { AIOperations, AIPendingAction, AIState } from "./ai";

type Run = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<boolean>;
type ModuleId = "tasks" | "calendar" | "ai_chat" | "notifications" | "holidays";

const modules: Array<{ id: ModuleId; label: string }> = [
  { id: "tasks", label: "任務" },
  { id: "calendar", label: "Google Calendar" },
  { id: "ai_chat", label: "AI Chat" },
  { id: "notifications", label: "通知" },
  { id: "holidays", label: "假日提醒" },
];
const priorityRank = { Urgent: 0, High: 1, Regular: 2 } as const;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function taskDate(task: Task, field: "due" | "start") {
  if (field === "start") return task.start_date;
  return task.due_at ? dateKey(new Date(task.due_at)) : null;
}

function isChinaWorkday(date: Date, calendar: CalendarDay[]) {
  const key = dateKey(date);
  const override = calendar.find(
    (item) => item.region === "CN" && item.day === key,
  );
  if (override) return override.day_type === "workday";
  const weekday = date.getDay();
  return weekday !== 0 && weekday !== 6;
}

export function nextChinaWorkdays(
  from: Date,
  calendar: CalendarDay[],
  count = 5,
) {
  const result: Date[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (result.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    if (isChinaWorkday(cursor, calendar)) result.push(new Date(cursor));
  }
  return result;
}

function taskSort(a: Task, b: Task) {
  return (
    priorityRank[a.priority] - priorityRank[b.priority] ||
    (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") ||
    a.position - b.position
  );
}

function TaskRows({
  title,
  tasks,
  openTask,
}: {
  title: string;
  tasks: Task[];
  openTask: (id: string) => void;
}) {
  return (
    <section className="today-group" aria-label={title}>
      <h3>
        {title} <span>{tasks.length}</span>
      </h3>
      {tasks.length ? (
        <ul>
          {tasks.sort(taskSort).map((task) => (
            <li key={task.id}>
              <button onClick={() => openTask(task.id)}>
                <strong>{task.title}</strong>
                <span className={`priority ${task.priority}`}>
                  {priorityLabels[task.priority]}
                </span>
                {task.due_at && (
                  <time>{new Date(task.due_at).toLocaleString("zh-TW")}</time>
                )}
                {!task.due_at && task.start_date && (
                  <time>{task.start_date}</time>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="subtle">目前沒有項目</p>
      )}
    </section>
  );
}

function Notifications({ items, run }: { items: Notification[]; run: Run }) {
  const unread = items.filter((item) => !item.read_at).length;
  return (
    <section className="today-module" aria-label="通知">
      <div className="module-heading">
        <div>
          <p className="eyebrow">NOTIFICATIONS</p>
          <h2>
            通知 <span>{unread} 未讀</span>
          </h2>
        </div>
        {unread > 0 && (
          <button onClick={() => void run("mark_all_notifications_read")}>
            全部標為已讀
          </button>
        )}
      </div>
      {items.length ? (
        <ol className="notification-list">
          {items.map((item) => (
            <li key={item.id} className={item.read_at ? "read" : "unread"}>
              <div>
                <strong>{item.title}</strong>
                {item.body && <p>{item.body}</p>}
                <time>{new Date(item.created_at).toLocaleString("zh-TW")}</time>
              </div>
              {!item.read_at && (
                <button
                  aria-label={`標為已讀 ${item.title}`}
                  onClick={() =>
                    void run("mark_notification_read", { id: item.id })
                  }
                >
                  已讀
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="subtle">目前沒有通知</p>
      )}
    </section>
  );
}

export function CalendarAgenda({
  dates,
  data,
  tasks,
  openTask,
}: {
  dates: Date[];
  data: Snapshot;
  tasks: Task[];
  openTask: (id: string) => void;
}) {
  return (
    <div className="calendar-agenda">
      {dates.map((date) => {
        const day = dateKey(date);
        const entries = [
          ...tasks
            .filter(
              (task) =>
                taskDate(task, "due") === day ||
                taskDate(task, "start") === day,
            )
            .map((task) => ({
              id: `task:${task.id}`,
              at: task.due_at ?? "9999",
              title: task.title,
              kind: "task" as const,
              task,
            })),
          ...data.google_events
            .filter((event) =>
              event.all_day
                ? event.start_date === day
                : Boolean(
                    event.start_at && dateKey(new Date(event.start_at)) === day,
                  ),
            )
            .map((event) => ({
              id: `event:${event.calendar_id}:${event.event_id}`,
              at: event.start_at ?? "9999",
              title: event.title,
              kind: "event" as const,
              event,
            })),
        ].sort((a, b) => a.at.localeCompare(b.at));
        return (
          <section className="agenda-day" key={day} aria-label={`行程 ${day}`}>
            <h3>
              {date.toLocaleDateString("zh-TW", {
                month: "numeric",
                day: "numeric",
                weekday: "short",
              })}
            </h3>
            {entries.length ? (
              <ol>
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <time>
                      {entry.at === "9999"
                        ? "無時間"
                        : new Date(entry.at).toLocaleTimeString("zh-TW", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                    </time>
                    {entry.kind === "task" ? (
                      <button onClick={() => openTask(entry.task.id)}>
                        <span>Task</span> {entry.title}
                      </button>
                    ) : entry.event.html_link ? (
                      <a
                        href={entry.event.html_link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>Calendar</span> {entry.title}
                      </a>
                    ) : (
                      <p>
                        <span>Calendar</span> {entry.title}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="subtle">沒有行程</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function Today({
  data,
  busy,
  openTask,
  run,
  calendar,
  syncCalendar,
  ai,
  resolveAIAction,
  refreshWorkspace,
}: {
  data: Snapshot;
  busy: boolean;
  openTask: (id: string) => void;
  run: Run;
  calendar?: CalendarOperations;
  syncCalendar: () => Promise<boolean>;
  ai?: AIOperations;
  resolveAIAction?: (
    action: AIPendingAction,
    confirm: boolean,
  ) => Promise<AIState>;
  refreshWorkspace: () => Promise<void>;
}) {
  const [editingLayout, setEditingLayout] = useState(false);
  const [editingCalendars, setEditingCalendars] = useState(false);
  const now = new Date();
  const today = dateKey(now);
  const incomplete = data.tasks.filter((task) => {
    const column = data.columns.find((item) => item.id === task.column_id);
    return column?.kind !== "done";
  });
  const futureDays = useMemo(
    () => nextChinaWorkdays(now, data.calendar_days),
    [today, data.calendar_days],
  );
  const overdue = incomplete.filter(
    (task) => taskDate(task, "due") && taskDate(task, "due")! < today,
  );
  const todayTasks = incomplete.filter(
    (task) =>
      taskDate(task, "due") === today || taskDate(task, "start") === today,
  );
  const unscheduled = incomplete.filter((task) => !task.due_at);
  const holidayReminders = data.calendar_days.filter((item) => {
    if (item.region !== "TW" || item.day_type !== "holiday") return false;
    const diff = Math.round(
      (new Date(`${item.day}T00:00:00`).getTime() -
        new Date(`${today}T00:00:00`).getTime()) /
        86400000,
    );
    return diff === 14 || diff === 3 || diff === 1;
  });
  const configured = data.preferences.module_order.filter(
    (id): id is ModuleId => modules.some((module) => module.id === id),
  );
  const order = [
    ...configured,
    ...modules
      .map((module) => module.id)
      .filter((id) => !configured.includes(id)),
  ];
  const hidden = data.preferences.hidden_modules.filter((id): id is ModuleId =>
    modules.some((module) => module.id === id),
  );

  async function saveLayout(nextOrder: ModuleId[], nextHidden: ModuleId[]) {
    await run("save_today_preferences", {
      module_order: nextOrder,
      hidden_modules: nextHidden,
    });
  }

  function renderModule(id: ModuleId) {
    if (id === "tasks")
      return (
        <section className="today-module" aria-label="今日任務">
          <div className="module-heading">
            <div>
              <p className="eyebrow">TASKS</p>
              <h2>今天要做什麼</h2>
            </div>
          </div>
          <TaskRows title="逾期未完成" tasks={overdue} openTask={openTask} />
          <TaskRows title="今日任務" tasks={todayTasks} openTask={openTask} />
          <div className="future-grid">
            {futureDays.map((day) => {
              const key = dateKey(day);
              return (
                <TaskRows
                  key={key}
                  title={`${day.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", weekday: "short" })}${data.calendar_days.some((item) => item.region === "CN" && item.day === key && item.day_type === "workday") ? " · 補班" : ""}`}
                  tasks={incomplete.filter(
                    (task) =>
                      taskDate(task, "due") === key ||
                      taskDate(task, "start") === key,
                  )}
                  openTask={openTask}
                />
              );
            })}
          </div>
          <TaskRows title="未排程" tasks={unscheduled} openTask={openTask} />
        </section>
      );
    if (id === "calendar") {
      const selected = data.google_calendars.filter((item) => item.selected);
      return (
        <section className="today-module" aria-label="Google Calendar">
          <div className="module-heading">
            <div>
              <p className="eyebrow">GOOGLE CALENDAR</p>
              <h2>
                行程 <span>{selected.length} 個 Calendar</span>
              </h2>
              <p className="subtle">
                {data.google_calendar_sync.last_error
                  ? `上次同步失敗：${data.google_calendar_sync.last_error}`
                  : data.google_calendar_sync.last_success_at
                    ? `上次同步 ${new Date(data.google_calendar_sync.last_success_at).toLocaleString("zh-TW")}`
                    : "尚未同步"}
              </p>
            </div>
            <div className="calendar-actions">
              {calendar?.tokenAvailable ? (
                <>
                  <button disabled={busy} onClick={() => void syncCalendar()}>
                    {data.google_calendar_sync.last_error ? "重試同步" : "同步"}
                  </button>
                  {data.google_calendar_sync.last_error && (
                    <button
                      disabled={busy}
                      onClick={() => void calendar.connect()}
                    >
                      重新連結
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => setEditingCalendars((value) => !value)}
                  >
                    選擇 Calendar
                  </button>
                </>
              ) : (
                <button
                  disabled={busy || !calendar}
                  onClick={() => void calendar?.connect()}
                >
                  連結 Google Calendar
                </button>
              )}
            </div>
          </div>
          {editingCalendars && data.google_calendars.length > 0 && (
            <fieldset className="calendar-picker">
              <legend>顯示的 Calendar</legend>
              {data.google_calendars.map((item) => (
                <label key={item.calendar_id}>
                  <input
                    type="checkbox"
                    checked={item.selected}
                    disabled={busy}
                    onChange={(event) => {
                      const ids = data.google_calendars
                        .filter((candidate) =>
                          candidate.calendar_id === item.calendar_id
                            ? event.target.checked
                            : candidate.selected,
                        )
                        .map((candidate) => candidate.calendar_id);
                      void run("calendar_set_selections", {
                        calendar_ids: ids,
                      });
                    }}
                  />
                  <i style={{ background: item.color }} />
                  {item.summary}
                  {item.is_primary ? "（主要）" : ""}
                </label>
              ))}
              <p className="subtle">變更後按「同步」更新事件快取。</p>
            </fieldset>
          )}
          {data.google_calendar_sync.last_error && (
            <p className="error" role="alert">
              Task 與最後成功同步的事件仍保留。請重新連結或重試同步。
            </p>
          )}
          <CalendarAgenda
            dates={[now, ...futureDays]}
            data={data}
            tasks={incomplete}
            openTask={openTask}
          />
        </section>
      );
    }
    if (id === "notifications")
      return <Notifications items={data.notifications} run={run} />;
    if (id === "ai_chat")
      return (
        <AIChat
          compact
          operations={ai}
          resolveAction={resolveAIAction}
          onWorkspaceChanged={refreshWorkspace}
        />
      );
    return (
      <section className="today-module" aria-label="假日提醒">
        <div className="module-heading">
          <div>
            <p className="eyebrow">TAIWAN HOLIDAYS</p>
            <h2>台灣假日提醒</h2>
          </div>
        </div>
        {holidayReminders.length ? (
          <ul className="holiday-list">
            {holidayReminders.map((item) => (
              <li key={item.day}>
                <strong>{item.name}</strong>
                <span>{item.day}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="subtle">未來 14 天沒有需要提醒的台灣假日</p>
        )}
      </section>
    );
  }

  return (
    <>
      <div className="heading today-heading">
        <div>
          <p className="eyebrow">
            {now.toLocaleDateString("zh-TW", { dateStyle: "full" })}
          </p>
          <h1>今天</h1>
          <p className="muted">依中國實際工作日安排接下來五個工作日。</p>
        </div>
        <button
          disabled={busy}
          onClick={() => setEditingLayout((value) => !value)}
        >
          {editingLayout ? "完成版面編輯" : "編輯版面"}
        </button>
      </div>
      {editingLayout && (
        <section className="layout-editor" aria-label="Today 版面設定">
          <h2>版面模組</h2>
          {order.map((id, index) => {
            const module = modules.find((item) => item.id === id)!;
            const isHidden = hidden.includes(id);
            return (
              <div key={id}>
                <strong>{module.label}</strong>
                <button
                  aria-label={`上移模組 ${module.label}`}
                  disabled={busy || index === 0}
                  onClick={() => {
                    const next = [...order];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    void saveLayout(next, hidden);
                  }}
                >
                  ↑
                </button>
                <button
                  aria-label={`下移模組 ${module.label}`}
                  disabled={busy || index === order.length - 1}
                  onClick={() => {
                    const next = [...order];
                    [next[index + 1], next[index]] = [
                      next[index],
                      next[index + 1],
                    ];
                    void saveLayout(next, hidden);
                  }}
                >
                  ↓
                </button>
                <button
                  onClick={() =>
                    void saveLayout(
                      order,
                      isHidden
                        ? hidden.filter((item) => item !== id)
                        : [...hidden, id],
                    )
                  }
                >
                  {isHidden ? "顯示" : "隱藏"}
                </button>
              </div>
            );
          })}
        </section>
      )}
      <div className="today-modules">
        {order
          .filter((id) => !hidden.includes(id))
          .map((id) => (
            <div key={id}>{renderModule(id)}</div>
          ))}
      </div>
    </>
  );
}
