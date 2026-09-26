import { useEffect, useMemo, useState } from "react";
import {
  priorityLabels,
  type CalendarDay,
  type GoogleCalendarEvent,
  type Snapshot,
  type Task,
} from "./domain";
import type { CalendarOperations } from "./Board";
import { ExecutionSummary } from "./ExecutionCenter";
import type { WorkflowState } from "./workflow";
import {
  emptyExchangeRateState,
  ExchangeRates,
  type ExchangeRateOperations,
} from "./exchangeRates";

type Run = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<boolean>;
type ModuleId =
  | "tasks"
  | "calendar"
  | "ai_execution"
  | "holidays"
  | "exchange_rates";

const modules: Array<{ id: ModuleId; label: string }> = [
  { id: "tasks", label: "任務" },
  { id: "calendar", label: "Google Calendar" },
  { id: "ai_execution", label: "AI 執行狀態" },
  { id: "holidays", label: "假日提醒" },
  { id: "exchange_rates", label: "玉山外幣匯率" },
];
const priorityRank = { Urgent: 0, High: 1, Regular: 2 } as const;

function LayoutModuleRow({
  id,
  label,
  hidden,
  busy,
  first,
  last,
  move,
  toggle,
  start,
  drop,
}: {
  id: ModuleId;
  label: string;
  hidden: boolean;
  busy: boolean;
  first: boolean;
  last: boolean;
  move: (offset: -1 | 1) => void;
  toggle: () => void;
  start: () => void;
  drop: () => void;
}) {
  const dragId = `today-module:${id}`;
  return (
    <div
      className="layout-module-row"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        drop();
      }}
    >
      <button
        className="layout-grip"
        aria-label={`拖曳模組 ${label}`}
        disabled={busy}
        draggable={!busy}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", dragId);
          start();
        }}
      >
        ⠿
      </button>
      <strong>{label}</strong>
      <button
        aria-label={`上移模組 ${label}`}
        disabled={busy || first}
        onClick={() => move(-1)}
      >
        ↑
      </button>
      <button
        aria-label={`下移模組 ${label}`}
        disabled={busy || last}
        onClick={() => move(1)}
      >
        ↓
      </button>
      <button onClick={toggle}>{hidden ? "顯示" : "隱藏"}</button>
    </div>
  );
}

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
  futureStartDay,
}: {
  title: string;
  tasks: Task[];
  openTask: (id: string) => void;
  futureStartDay?: string;
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
                {futureStartDay && task.start_date === futureStartDay && (
                  <span className="not-started">尚未開始</span>
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

export function CalendarAgenda({
  dates,
  data,
  tasks,
  openTask,
  createCalendarRun,
}: {
  dates: Date[];
  data: Snapshot;
  tasks: Task[];
  openTask: (id: string) => void;
  createCalendarRun?: (event: GoogleCalendarEvent) => Promise<boolean>;
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
                    ) : (
                      <div className="calendar-event-actions">
                        {entry.event.html_link ? (
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
                        {createCalendarRun && (
                          <button
                            type="button"
                            onClick={() => void createCalendarRun(entry.event)}
                          >
                            建立 Run
                          </button>
                        )}
                      </div>
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
  workflowState,
  openRun,
  createCalendarRun,
  exchangeRates,
}: {
  data: Snapshot;
  busy: boolean;
  openTask: (id: string) => void;
  run: Run;
  calendar?: CalendarOperations;
  syncCalendar: () => Promise<boolean>;
  workflowState: WorkflowState;
  openRun: (id: string) => void;
  createCalendarRun: (event: GoogleCalendarEvent) => Promise<boolean>;
  exchangeRates?: ExchangeRateOperations;
}) {
  const [editingLayout, setEditingLayout] = useState(false);
  const [editingCalendars, setEditingCalendars] = useState(false);
  const [rateState, setRateState] = useState(emptyExchangeRateState);
  const [rateBusy, setRateBusy] = useState(false);
  const [draggingModule, setDraggingModule] = useState<ModuleId | null>(null);
  const [holidaysExpanded, setHolidaysExpanded] = useState(false);
  useEffect(() => {
    if (!exchangeRates) return;
    let cancelled = false;
    exchangeRates
      .load()
      .then((next) => {
        if (!cancelled) setRateState(next);
      })
      .catch((reason) => {
        if (!cancelled)
          setRateState((current) => ({
            ...current,
            last_error:
              reason instanceof Error ? reason.message : String(reason),
          }));
      });
    return () => {
      cancelled = true;
    };
  }, [exchangeRates]);
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
  const upcomingHolidays = data.calendar_days
    .filter(
      (item) =>
        item.region === "TW" &&
        item.day_type === "holiday" &&
        item.day >= today,
    )
    .sort((a, b) => a.day.localeCompare(b.day));
  const displayedHolidays = holidaysExpanded
    ? upcomingHolidays
    : upcomingHolidays.slice(0, 2);
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

  function moveLayout(active: ModuleId, over: ModuleId) {
    const from = order.indexOf(active);
    const to = order.indexOf(over);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void saveLayout(next, hidden);
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
                  futureStartDay={key}
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
            createCalendarRun={createCalendarRun}
          />
        </section>
      );
    }
    if (id === "ai_execution")
      return <ExecutionSummary state={workflowState} openRun={openRun} />;
    if (id === "exchange_rates")
      return (
        <ExchangeRates
          state={rateState}
          busy={rateBusy}
          refresh={() => {
            if (!exchangeRates || rateBusy) return;
            setRateBusy(true);
            exchangeRates
              .refresh()
              .then(setRateState)
              .catch((reason) =>
                setRateState((current) => ({
                  ...current,
                  last_error:
                    reason instanceof Error ? reason.message : String(reason),
                })),
              )
              .finally(() => setRateBusy(false));
          }}
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
        {displayedHolidays.length ? (
          <ul className="holiday-list">
            {displayedHolidays.map((item) => (
              <li key={item.day}>
                <strong>{item.name}</strong>
                <span>{item.day}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="subtle">未來 14 天沒有需要提醒的台灣假日</p>
        )}
        {upcomingHolidays.length > 2 && (
          <button
            className="holiday-expand"
            type="button"
            aria-expanded={holidaysExpanded}
            onClick={() => setHolidaysExpanded((value) => !value)}
          >
            {holidaysExpanded
              ? "收合"
              : `展開更多（${upcomingHolidays.length - 2}）`}
          </button>
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
          <div>
            {order.map((id, index) => {
              const module = modules.find((item) => item.id === id)!;
              const isHidden = hidden.includes(id);
              return (
                <LayoutModuleRow
                  key={id}
                  id={id}
                  label={module.label}
                  hidden={isHidden}
                  busy={busy}
                  first={index === 0}
                  last={index === order.length - 1}
                  move={(offset) => moveLayout(id, order[index + offset])}
                  toggle={() =>
                    void saveLayout(
                      order,
                      isHidden
                        ? hidden.filter((item) => item !== id)
                        : [...hidden, id],
                    )
                  }
                  start={() => setDraggingModule(id)}
                  drop={() => {
                    if (draggingModule) moveLayout(draggingModule, id);
                    setDraggingModule(null);
                  }}
                />
              );
            })}
          </div>
        </section>
      )}
      <div className="today-modules">
        <div className="today-primary">
          {order
            .filter(
              (id) =>
                !hidden.includes(id) &&
                id !== "holidays" &&
                id !== "exchange_rates",
            )
            .map((id) => (
              <div key={id}>{renderModule(id)}</div>
            ))}
        </div>
        <div className="today-aside">
          {order
            .filter(
              (id) =>
                !hidden.includes(id) &&
                (id === "holidays" || id === "exchange_rates"),
            )
            .map((id) => (
              <div key={id}>{renderModule(id)}</div>
            ))}
        </div>
      </div>
    </>
  );
}
