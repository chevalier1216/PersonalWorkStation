import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  taskInput,
  kindLabels,
  priorityLabels,
  sortedTasks,
  type Column,
  type Task,
  type Snapshot,
  type Kind,
  type Priority,
} from "./domain";
import { TaskDetails } from "./TaskDetails";
import { Today } from "./Today";
import { AIChat } from "./AIChat";
import type { AIOperations, AIPendingAction } from "./ai";
import type { SummaryOperations } from "./summary";
import type { SearchOperations } from "./search";
import { SearchView } from "./SearchView";
import type { AttachmentOperations } from "./attachments";
import { MaintenanceView } from "./MaintenanceView";
import { CalendarView } from "./CalendarView";
import { SummaryView } from "./SummaryView";
export type Execute = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<Snapshot>;
export type CalendarOperations = {
  tokenAvailable: boolean;
  connect: () => Promise<void>;
  sync: (snapshot: Snapshot) => Promise<Snapshot>;
  create: (task: Task, calendarId: string) => Promise<Snapshot>;
};
function Drop({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={isOver ? "task-list over" : "task-list"}>
      {children}
    </div>
  );
}
function Card({
  task,
  busy,
  edit,
  move,
  columns,
  index,
  count,
  tags,
  checklistDone,
  checklistTotal,
  blockedBy,
}: {
  task: Task;
  busy: boolean;
  edit: () => void;
  move: (column: string, position?: number) => void;
  columns: Column[];
  index: number;
  count: number;
  tags: Snapshot["tags"];
  checklistDone: number;
  checklistTotal: number;
  blockedBy: string[];
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    disabled: busy,
  });
  return (
    <article
      ref={setNodeRef}
      className="task"
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
        zIndex: transform ? 5 : undefined,
      }}
    >
      <div className="card-top">
        <span className={`priority ${task.priority}`}>
          {priorityLabels[task.priority]}
        </span>
        <button
          className="grip"
          {...attributes}
          {...listeners}
          aria-label={`拖曳 ${task.title}`}
          disabled={busy}
        >
          ⠿
        </button>
      </div>
      <button className="task-title" onClick={edit} disabled={busy}>
        {task.title}
      </button>
      {task.description && <p className="description">{task.description}</p>}
      {(tags.length > 0 || checklistTotal > 0 || blockedBy.length > 0) && (
        <div className="card-meta">
          {blockedBy.length > 0 && (
            <span className="blocked" title={blockedBy.join("、")}>
              被阻擋 · {blockedBy.length}
            </span>
          )}
          {checklistTotal > 0 && (
            <span>
              Checklist {checklistDone}/{checklistTotal}
            </span>
          )}
          {tags.map((tag) => (
            <span
              className="mini-tag"
              key={tag.id}
              style={{ borderColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
      {task.start_date && <p className="date">開始 {task.start_date}</p>}
      {task.due_at && (
        <p className="date">
          截止 {new Date(task.due_at).toLocaleString("zh-TW")}
        </p>
      )}
      {task.completed_at && (
        <p className="date">
          完成 {new Date(task.completed_at).toLocaleString("zh-TW")}
        </p>
      )}
      <div className="task-actions">
        <select
          aria-label={`移動 ${task.title}`}
          value={task.column_id}
          disabled={busy}
          onChange={(e) => move(e.target.value)}
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          aria-label={`上移 ${task.title}`}
          disabled={busy || index === 0}
          onClick={() => move(task.column_id, index - 1)}
        >
          ↑
        </button>
        <button
          aria-label={`下移 ${task.title}`}
          disabled={busy || index === count - 1}
          onClick={() => move(task.column_id, index + 1)}
        >
          ↓
        </button>
      </div>
    </article>
  );
}
export function Board({
  execute,
  onSignOut,
  calendar,
  ai,
  summaries,
  search,
  attachments,
}: {
  execute: Execute;
  onSignOut?: () => Promise<void>;
  calendar?: CalendarOperations;
  ai?: AIOperations;
  summaries?: SummaryOperations;
  search?: SearchOperations;
  attachments?: AttachmentOperations;
}) {
  const [data, setData] = useState<Snapshot>({
    columns: [],
    tasks: [],
    tags: [],
    checklist: [],
    notes: [],
    relations: [],
    history: [],
    notifications: [],
    preferences: {
      module_order: ["tasks", "calendar", "notifications", "holidays"],
      hidden_modules: [],
      updated_at: "",
    },
    calendar_days: [],
    google_calendars: [],
    google_events: [],
    task_calendar_links: [],
    google_calendar_sync: {
      last_attempt_at: null,
      last_success_at: null,
      last_error: "",
    },
  });
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [quick, setQuick] = useState("");
  const [editingTarget, setEditingTarget] = useState<{
    taskId: string;
    noteId?: string;
    summaryId?: string;
  } | null>(null);
  const editingId = editingTarget?.taskId ?? null;
  const editing = data.tasks.find((task) => task.id === editingId) ?? null;
  const [pendingMove, setPendingMove] = useState<{
    task: Task;
    column_id: string;
    position?: number;
  } | null>(null);
  const [managing, setManaging] = useState<Column | null>(null);
  const [addColumn, setAddColumn] = useState(false);
  const [view, setView] = useState<
    "today" | "board" | "calendar" | "ai" | "summary" | "search" | "settings"
  >("today");
  const [aiConversationId, setAIConversationId] = useState<string | null>(null);
  const openTask = (taskId: string, noteId?: string, summaryId?: string) =>
    setEditingTarget({ taskId, noteId, summaryId });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  async function run(action: string, payload: Record<string, unknown> = {}) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setData(await execute(action, payload));
      setLoaded(true);
      setNotice(action === "load" ? "資料已更新" : "已儲存");
      return true;
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "操作失敗") +
          "。資料尚未確認儲存，請重新整理確認後再試。",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function runCalendar(operation: () => Promise<Snapshot>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setData(await operation());
      setLoaded(true);
      setNotice("Calendar 狀態已更新");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google Calendar 操作失敗");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    void run("load");
  }, [execute]);
  async function quickAdd(e: FormEvent) {
    e.preventDefault();
    const parsed = taskInput.safeParse({
      title: quick,
      description: "",
      priority: "Regular",
      due_at: null,
      start_date: null,
      estimated_minutes: null,
      deliverable_type: null,
      deliverable_value: null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (await run("create_task", parsed.data)) setQuick("");
  }
  function dragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const task = data.tasks.find((t) => t.id === e.active.id);
    if (task && task.column_id !== e.over.id)
      requestMove(task, String(e.over.id));
  }
  function requestMove(task: Task, column_id: string, position?: number) {
    const destination = data.columns.find((column) => column.id === column_id);
    const hasOpenChecklist = data.checklist.some(
      (item) => item.task_id === task.id && !item.completed,
    );
    if (destination?.kind === "done" && hasOpenChecklist) {
      setPendingMove({ task, column_id, position });
      return;
    }
    void run("move_task", { id: task.id, column_id, position });
  }
  async function resolveAIAction(action: AIPendingAction, confirm: boolean) {
    if (!ai) throw new Error("AI 操作尚未設定");
    if (confirm && action.action_type === "calendar_relation") {
      if (!calendar) throw new Error("Google Calendar 尚未設定");
      const task = data.tasks.find(
        (item) => item.id === action.payload.task_id,
      );
      const calendarId = String(action.payload.calendar_id ?? "");
      if (!task) throw new Error("找不到要建立 Calendar event 的 Task");
      if (!calendarId) throw new Error("待確認動作缺少 Calendar");
      setData(await calendar.create(task, calendarId));
      setLoaded(true);
      setNotice("Calendar 狀態已更新");
    }
    return ai.resolve(action, confirm);
  }
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        跳至主要內容
      </a>
      <header>
        <a className="brand" href={import.meta.env.BASE_URL}>
          個人工作臺<span>PERSONAL WORKSTATION</span>
        </a>
        <div className="header-actions">
          <span className="private">私人看板</span>
          {onSignOut && (
            <button
              disabled={busy}
              onClick={() => onSignOut().catch((e) => setError(e.message))}
            >
              登出
            </button>
          )}
        </div>
      </header>
      <nav className="primary-nav" aria-label="主要導覽">
        <button
          aria-current={view === "today" ? "page" : undefined}
          onClick={() => setView("today")}
        >
          今日
        </button>
        <button
          aria-current={view === "board" ? "page" : undefined}
          onClick={() => setView("board")}
        >
          任務看板
        </button>
        <button
          aria-current={view === "calendar" ? "page" : undefined}
          onClick={() => setView("calendar")}
        >
          行事曆
        </button>
        <button
          aria-current={view === "ai" ? "page" : undefined}
          onClick={() => setView("ai")}
        >
          AI 對話
        </button>
        <button
          aria-current={view === "summary" ? "page" : undefined}
          onClick={() => setView("summary")}
        >
          AI 摘要
        </button>
        <button
          aria-current={view === "search" ? "page" : undefined}
          onClick={() => setView("search")}
        >
          歷史紀錄
        </button>
        <button
          aria-current={view === "settings" ? "page" : undefined}
          onClick={() => setView("settings")}
        >
          設定
        </button>
      </nav>
      {view === "today" ? (
        <main id="main-content">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div
            className="status"
            role="status"
            aria-label="儲存狀態"
            aria-live="polite"
          >
            {busy ? "正在儲存或載入…" : notice}
          </div>
          <Today
            data={data}
            busy={busy}
            openTask={(id) => openTask(id)}
            run={run}
            calendar={calendar}
            syncCalendar={() =>
              calendar
                ? runCalendar(() => calendar.sync(data))
                : Promise.resolve(false)
            }
            ai={ai}
            resolveAIAction={resolveAIAction}
            refreshWorkspace={async () => {
              await run("load");
            }}
          />
        </main>
      ) : view === "calendar" ? (
        <main id="main-content">
          <CalendarView
            data={data}
            busy={busy}
            calendar={calendar}
            run={run}
            syncCalendar={() =>
              calendar
                ? runCalendar(() => calendar.sync(data))
                : Promise.resolve(false)
            }
            openTask={(id) => openTask(id)}
          />
        </main>
      ) : view === "ai" ? (
        <main id="main-content">
          <AIChat
            operations={ai}
            resolveAction={resolveAIAction}
            onWorkspaceChanged={async () => {
              await run("load");
            }}
            initialConversationId={aiConversationId}
          />
        </main>
      ) : view === "summary" ? (
        <main id="main-content">
          <SummaryView
            operations={summaries}
            tasks={data.tasks}
            openTask={(taskId, summaryId) =>
              openTask(taskId, undefined, summaryId)
            }
          />
        </main>
      ) : view === "search" ? (
        <main id="main-content">
          <SearchView
            operations={search}
            openTask={openTask}
            openConversation={(id) => {
              setAIConversationId(id);
              setView("ai");
            }}
          />
        </main>
      ) : view === "settings" ? (
        <main id="main-content">
          <MaintenanceView operations={attachments} />
        </main>
      ) : (
        <main id="main-content">
          <div className="heading">
            <div>
              <p className="eyebrow">把想法化為進展</p>
              <h1>任務看板</h1>
              <p className="muted">
                {data.tasks.filter((t) => !t.completed_at).length} 件待完成 ·
                每一步，都留下進度。
              </p>
            </div>
            <div className="toolbar">
              <button disabled={busy} onClick={() => void run("load")}>
                重新整理
              </button>
              <button
                disabled={!loaded || busy}
                onClick={() => setAddColumn(true)}
              >
                新增欄位
              </button>
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div
            className="status"
            role="status"
            aria-label="儲存狀態"
            aria-live="polite"
          >
            {busy ? "正在儲存或載入…" : notice}
          </div>
          <form className="quick-add" onSubmit={quickAdd}>
            <label htmlFor="quick">下一件要做的事</label>
            <div>
              <input
                id="quick"
                placeholder="輸入標題，按 Enter 建立"
                value={quick}
                maxLength={300}
                onChange={(e) => setQuick(e.target.value)}
                disabled={!loaded || busy}
              />
              <button
                className="primary"
                disabled={!loaded || busy || !quick.trim()}
              >
                新增任務
              </button>
            </div>
          </form>
          <DndContext sensors={sensors} onDragEnd={dragEnd}>
            <div className="board" aria-busy={busy}>
              {data.columns.map((column, ci) => {
                const tasks = sortedTasks(
                  data.tasks.filter((t) => t.column_id === column.id),
                );
                return (
                  <section
                    className="column"
                    key={column.id}
                    aria-label={column.title}
                  >
                    <div className="column-header">
                      <div>
                        <h2>
                          {column.title} <span>{tasks.length}</span>
                        </h2>
                        <small>{kindLabels[column.kind]}</small>
                      </div>
                      <div>
                        <button
                          aria-label={`左移欄位 ${column.title}`}
                          disabled={busy || ci === 0}
                          onClick={() =>
                            void run("move_column", {
                              id: column.id,
                              position: ci - 1,
                            })
                          }
                        >
                          ←
                        </button>
                        <button
                          aria-label={`右移欄位 ${column.title}`}
                          disabled={busy || ci === data.columns.length - 1}
                          onClick={() =>
                            void run("move_column", {
                              id: column.id,
                              position: ci + 1,
                            })
                          }
                        >
                          →
                        </button>
                        <button
                          aria-label={`管理 ${column.title}`}
                          disabled={busy}
                          onClick={() => setManaging(column)}
                        >
                          ⋯
                        </button>
                      </div>
                    </div>
                    <Drop id={column.id}>
                      {tasks.length === 0 && (
                        <p className="empty">將任務移到這裡</p>
                      )}
                      {tasks.map((task, index) => (
                        <Card
                          key={task.id}
                          task={task}
                          busy={busy}
                          edit={() => openTask(task.id)}
                          columns={data.columns}
                          index={index}
                          count={tasks.length}
                          tags={data.tags.filter(
                            (tag) => tag.task_id === task.id,
                          )}
                          checklistDone={
                            data.checklist.filter(
                              (item) =>
                                item.task_id === task.id && item.completed,
                            ).length
                          }
                          checklistTotal={
                            data.checklist.filter(
                              (item) => item.task_id === task.id,
                            ).length
                          }
                          blockedBy={data.relations
                            .filter(
                              (relation) =>
                                relation.task_id === task.id &&
                                relation.relation_type === "prerequisite",
                            )
                            .map((relation) =>
                              data.tasks.find(
                                (item) => item.id === relation.related_task_id,
                              ),
                            )
                            .filter((item): item is Task =>
                              Boolean(item && !item.completed_at),
                            )
                            .map((item) => item.title)}
                          move={(column_id, position) =>
                            requestMove(task, column_id, position)
                          }
                        />
                      ))}
                    </Drop>
                  </section>
                );
              })}
            </div>
          </DndContext>
          {!loaded && !busy && (
            <p className="empty">
              尚未取得看板資料。請確認帳號權限與連線後重試。
            </p>
          )}
          <p className="footnote">
            拖曳卡片可跨欄移動；也可使用卡片下方選單與排序按鈕。
          </p>
        </main>
      )}
      {editing && (
        <Modal
          title="任務詳細資料"
          busy={busy}
          close={() => setEditingTarget(null)}
        >
          <TaskDetails
            task={editing}
            data={data}
            busy={busy}
            remoteError={error}
            close={() => setEditingTarget(null)}
            run={run}
            calendar={calendar}
            createCalendarEvent={(task, calendarId) =>
              calendar
                ? runCalendar(() => calendar.create(task, calendarId))
                : Promise.resolve(false)
            }
            summaries={summaries}
            initialNoteId={editingTarget?.noteId}
            initialSummaryId={editingTarget?.summaryId}
            attachments={attachments}
            remove={async () => {
              if (await run("delete_task", { id: editing.id }))
                setEditingTarget(null);
            }}
          />
        </Modal>
      )}
      {pendingMove && (
        <Modal
          title="Checklist 尚未完成"
          busy={busy}
          close={() => setPendingMove(null)}
        >
          <p>此任務仍有未完成的 Checklist。仍要標記為完成嗎？</p>
          <div className="dialog-actions">
            <button disabled={busy} onClick={() => setPendingMove(null)}>
              取消
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                const move = pendingMove;
                if (
                  await run("move_task", {
                    id: move.task.id,
                    column_id: move.column_id,
                    position: move.position,
                  })
                )
                  setPendingMove(null);
              }}
            >
              仍要完成
            </button>
          </div>
        </Modal>
      )}
      {(managing || addColumn) && (
        <ColumnEditor
          remoteError={error}
          key={managing?.id ?? "new"}
          column={managing}
          columns={data.columns}
          busy={busy}
          close={() => {
            setManaging(null);
            setAddColumn(false);
          }}
          save={async (payload) => {
            if (
              await run(managing ? "rename_column" : "create_column", {
                id: managing?.id,
                ...payload,
              })
            ) {
              setManaging(null);
              setAddColumn(false);
            }
          }}
          remove={async (replacement_id) => {
            if (
              await run("delete_column", { id: managing!.id, replacement_id })
            )
              setManaging(null);
          }}
        />
      )}
    </div>
  );
}
function Modal({
  title,
  close,
  busy,
  children,
}: {
  title: string;
  close: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
      aria-label={title}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button type="button" aria-label="關閉" disabled={busy} onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function TaskEditor({
  remoteError,
  task,
  busy,
  close,
  save,
  remove,
}: {
  remoteError: string;
  task: Task;
  busy: boolean;
  close: () => void;
  save: (p: Record<string, unknown>) => Promise<void>;
  remove: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title),
    [description, setDescription] = useState(task.description),
    [priority, setPriority] = useState<Priority>(task.priority),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const localDate = task.due_at
    ? new Date(
        new Date(task.due_at).getTime() -
          new Date(task.due_at).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
  const [due, setDue] = useState(localDate);
  return (
    <Modal title="編輯任務" busy={busy} close={close}>
      {remoteError && (
        <p className="error" role="alert">
          {remoteError}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const p = taskInput.safeParse({
            title,
            description,
            priority,
            due_at: due ? new Date(due).toISOString() : null,
          });
          if (!p.success) setError(p.error.issues[0].message);
          else void save(p.data);
        }}
      >
        <label>
          標題
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
            required
            autoFocus
          />
        </label>
        <label>
          說明
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={20000}
          />
        </label>
        <label>
          優先程度
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {Object.entries(priorityLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          截止時間（選填）
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions">
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            刪除任務
          </button>
          <button className="primary" disabled={busy}>
            儲存
          </button>
        </div>
        {confirm && (
          <div className="confirm">
            <p>確定刪除「{task.title}」與其狀態紀錄？此操作無法復原。</p>
            <button type="button" disabled={busy} onClick={() => void remove()}>
              確認刪除
            </button>
            <button
              type="button"
              onClick={() => setConfirm(false)}
              disabled={busy}
            >
              取消
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
function ColumnEditor({
  remoteError,
  column,
  columns,
  busy,
  close,
  save,
  remove,
}: {
  remoteError: string;
  column: Column | null;
  columns: Column[];
  busy: boolean;
  close: () => void;
  save: (p: Record<string, unknown>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(column?.title ?? ""),
    [kind, setKind] = useState<Kind>("todo"),
    [replacement, setReplacement] = useState(""),
    [confirm, setConfirm] = useState(false);
  const choices = columns.filter(
    (c) => c.id !== column?.id && c.kind === column?.kind,
  );
  return (
    <Modal title={column ? "管理欄位" : "新增欄位"} busy={busy} close={close}>
      {remoteError && (
        <p className="error" role="alert">
          {remoteError}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) void save({ title: title.trim(), kind });
        }}
      >
        <label>
          欄位名稱
          <input
            value={title}
            maxLength={80}
            required
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        {!column && (
          <label>
            任務狀態
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              {Object.entries(kindLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="primary" disabled={busy || !title.trim()}>
          儲存欄位
        </button>
      </form>
      {column && (
        <div className="delete-column">
          <h3>刪除欄位</h3>
          <p>任務會移至相同狀態的替代欄位。</p>
          {choices.length ? (
            <>
              <label>
                替代欄位
                <select
                  value={replacement}
                  onChange={(e) => {
                    setReplacement(e.target.value);
                    setConfirm(false);
                  }}
                >
                  <option value="">請選擇</option>
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              {confirm ? (
                <>
                  <p>確定搬移任務並刪除此欄位？</p>
                  <button
                    disabled={busy}
                    onClick={() => void remove(replacement)}
                  >
                    確認刪除欄位
                  </button>
                </>
              ) : (
                <button
                  className="danger"
                  disabled={busy || !replacement}
                  onClick={() => setConfirm(true)}
                >
                  刪除欄位
                </button>
              )}
            </>
          ) : (
            <p>請先新增另一個「{kindLabels[column.kind]}」欄位，再指定替代。</p>
          )}
        </div>
      )}
    </Modal>
  );
}
