import { useState, type FormEvent } from "react";
import {
  priorityLabels,
  rawDoingMinutes,
  recurrenceLabels,
  relationLabels,
  taskInput,
  type Priority,
  type RecurrenceType,
  type RecurrenceUnit,
  type RelationType,
  type Snapshot,
  type Task,
} from "./domain";
import type { CalendarOperations } from "./Board";

type Run = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<boolean>;

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function TaskDetails({
  task,
  data,
  busy,
  remoteError,
  close,
  run,
  remove,
  calendar,
  createCalendarEvent,
}: {
  task: Task;
  data: Snapshot;
  busy: boolean;
  remoteError: string;
  close: () => void;
  run: Run;
  remove: () => Promise<void>;
  calendar?: CalendarOperations;
  createCalendarEvent: (task: Task, calendarId: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [due, setDue] = useState(localDateTime(task.due_at));
  const [startDate, setStartDate] = useState(task.start_date ?? "");
  const [estimate, setEstimate] = useState(
    task.estimated_minutes?.toString() ?? "",
  );
  const [deliverableType, setDeliverableType] = useState(
    task.deliverable_type ?? "",
  );
  const [deliverableValue, setDeliverableValue] = useState(
    task.deliverable_value ?? "",
  );
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | "">(
    task.recurrence_type ?? "",
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(
    task.recurrence_interval?.toString() ?? "1",
  );
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>(
    task.recurrence_unit ?? "day",
  );
  const [localError, setLocalError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#7895b2");
  const [checkTitle, setCheckTitle] = useState("");
  const [checkDue, setCheckDue] = useState("");
  const [note, setNote] = useState("");
  const [relationType, setRelationType] =
    useState<RelationType>("prerequisite");
  const [relatedTask, setRelatedTask] = useState("");
  const calendarLink = data.task_calendar_links.find(
    (item) => item.task_id === task.id,
  );
  const selectedCalendars = data.google_calendars.filter((item) => item.selected);
  const [calendarId, setCalendarId] = useState(
    calendarLink?.calendar_id ?? selectedCalendars[0]?.calendar_id ?? "",
  );
  const tags = data.tags.filter((item) => item.task_id === task.id);
  const checklist = data.checklist.filter((item) => item.task_id === task.id);
  const notes = data.notes.filter((item) => item.task_id === task.id);
  const relations = data.relations.filter((item) => item.task_id === task.id);
  const taskName = (id: string) =>
    data.tasks.find((item) => item.id === id)?.title ?? "已移除的任務";
  const rawMinutes = rawDoingMinutes(data.history, task.id);

  async function save(e: FormEvent) {
    e.preventDefault();
    const parsed = taskInput.safeParse({
      title,
      description,
      priority,
      due_at: due ? new Date(due).toISOString() : null,
      start_date: startDate || null,
      estimated_minutes: estimate ? Number(estimate) : null,
      deliverable_type: deliverableType || null,
      deliverable_value: deliverableValue || null,
      recurrence_type: recurrenceType || null,
      recurrence_interval: recurrenceType ? Number(recurrenceInterval || 1) : null,
      recurrence_unit: recurrenceType === "custom" ? recurrenceUnit : null,
    });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0].message);
      return;
    }
    setLocalError("");
    await run("edit_task", { id: task.id, ...parsed.data });
  }

  return (
    <div className="task-detail-grid">
      {(remoteError || localError) && (
        <p className="error" role="alert">
          {remoteError || localError}
        </p>
      )}
      <form className="detail-section" onSubmit={save}>
        <h3>基本資料</h3>
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
        <div className="field-row">
          <label>
            優先程度
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            開始日期（選填）
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
        </div>
        <div className="field-row">
          <label>
            循環任務
            <select
              aria-label="循環任務"
              value={recurrenceType}
              onChange={(e) =>
                setRecurrenceType(e.target.value as RecurrenceType | "")
              }
            >
              <option value="">不循環</option>
              {Object.entries(recurrenceLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {recurrenceType && (
            <label>
              間隔
              <input
                aria-label="循環間隔"
                type="number"
                min="1"
                max="365"
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(e.target.value)}
              />
            </label>
          )}
          {recurrenceType === "custom" && (
            <label>
              自訂單位
              <select
                aria-label="自訂循環單位"
                value={recurrenceUnit}
                onChange={(e) => setRecurrenceUnit(e.target.value as RecurrenceUnit)}
              >
                <option value="day">天</option>
                <option value="week">週</option>
                <option value="month">月</option>
              </select>
            </label>
          )}
        </div>
        <div className="field-row">
          <label>
            截止時間（選填）
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label>
            預估分鐘（選填）
            <input
              type="number"
              min="1"
              max="525600"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </label>
        </div>
        <div className="field-row">
          <label>
            交付物類型（選填）
            <input
              placeholder="Link、File、PR、Document…"
              value={deliverableType}
              maxLength={40}
              onChange={(e) => setDeliverableType(e.target.value)}
            />
          </label>
          <label>
            交付物內容（選填）
            <input
              value={deliverableValue}
              maxLength={5000}
              onChange={(e) => setDeliverableValue(e.target.value)}
            />
          </label>
        </div>
        <p className="detail-meta">
          Doing 原始經過時間：{rawMinutes} 分鐘
          {task.completed_at
            ? ` · 完成 ${new Date(task.completed_at).toLocaleString("zh-TW")}`
            : ""}
        </p>
        <button className="primary" disabled={busy}>
          儲存基本資料
        </button>
      </form>

      <section className="detail-section">
        <h3>標籤</h3>
        <div className="chips">
          {tags.map((tag) => (
            <span
              className="chip"
              key={tag.id}
              style={{ borderColor: tag.color }}
            >
              <i style={{ background: tag.color }} /> {tag.name}
              <button
                type="button"
                aria-label={`移除標籤 ${tag.name}`}
                disabled={busy}
                onClick={() => void run("remove_tag", { id: tag.id })}
              >
                ×
              </button>
            </span>
          ))}
          {!tags.length && <span className="subtle">尚無標籤</span>}
        </div>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              tagName.trim() &&
              (await run("add_tag", {
                task_id: task.id,
                name: tagName.trim(),
                color: tagColor,
              }))
            )
              setTagName("");
          }}
        >
          <input
            aria-label="新標籤"
            placeholder="標籤名稱"
            maxLength={40}
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
          />
          <input
            aria-label="標籤顏色"
            type="color"
            value={tagColor}
            onChange={(e) => setTagColor(e.target.value)}
          />
          <button disabled={busy || !tagName.trim()}>新增標籤</button>
        </form>
      </section>

      <section className="detail-section">
        <h3>Checklist</h3>
        <ul className="checklist">
          {checklist.map((item) => (
            <li key={item.id}>
              <input
                aria-label={`完成 ${item.title}`}
                type="checkbox"
                checked={item.completed}
                disabled={busy}
                onChange={(e) =>
                  void run("toggle_checklist", {
                    id: item.id,
                    completed: e.target.checked,
                  })
                }
              />
              <span className={item.completed ? "checked" : ""}>
                {item.title}
                {item.due_date ? ` · ${item.due_date}` : ""}
              </span>
              <button
                type="button"
                aria-label={`移除清單項目 ${item.title}`}
                disabled={busy}
                onClick={() => void run("delete_checklist", { id: item.id })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              checkTitle.trim() &&
              (await run("add_checklist", {
                task_id: task.id,
                title: checkTitle.trim(),
                due_date: checkDue || null,
              }))
            ) {
              setCheckTitle("");
              setCheckDue("");
            }
          }}
        >
          <input
            aria-label="新清單項目"
            placeholder="清單項目"
            maxLength={300}
            value={checkTitle}
            onChange={(e) => setCheckTitle(e.target.value)}
          />
          <input
            aria-label="清單截止日期"
            type="date"
            value={checkDue}
            onChange={(e) => setCheckDue(e.target.value)}
          />
          <button disabled={busy || !checkTitle.trim()}>新增項目</button>
        </form>
      </section>

      <section className="detail-section">
        <h3>任務關聯</h3>
        <ul className="relations">
          {relations.map((item) => (
            <li key={item.id}>
              <span>{relationLabels[item.relation_type]}</span>
              <strong>{taskName(item.related_task_id)}</strong>
              <button
                type="button"
                aria-label={`移除關聯 ${taskName(item.related_task_id)}`}
                disabled={busy}
                onClick={() => void run("remove_relation", { id: item.id })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              relatedTask &&
              (await run("add_relation", {
                task_id: task.id,
                related_task_id: relatedTask,
                relation_type: relationType,
              }))
            )
              setRelatedTask("");
          }}
        >
          <select
            aria-label="關聯類型"
            value={relationType}
            onChange={(e) => setRelationType(e.target.value as RelationType)}
          >
            {Object.entries(relationLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="關聯任務"
            value={relatedTask}
            onChange={(e) => setRelatedTask(e.target.value)}
          >
            <option value="">選擇任務</option>
            {data.tasks
              .filter((item) => item.id !== task.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
          </select>
          <button disabled={busy || !relatedTask}>新增關聯</button>
        </form>
      </section>

      <section className="detail-section full-width">
        <h3>Google Calendar</h3>
        {calendarLink?.sync_status === "synced" ? (
          <p className="calendar-link-state success">
            已關聯「
            {data.google_calendars.find(
              (item) => item.calendar_id === calendarLink.calendar_id,
            )?.summary ?? calendarLink.calendar_id}
            」
            {calendarLink.html_link && (
              <> · <a href={calendarLink.html_link} target="_blank" rel="noreferrer">開啟事件</a></>
            )}
          </p>
        ) : calendarLink ? (
          <p className="calendar-link-state error" role="alert">
            同步失敗：{calendarLink.sync_error}
          </p>
        ) : (
          <p className="subtle">
            有截止時間會建立 timed event；只有開始日期會建立 all-day event。
          </p>
        )}
        {!calendar?.tokenAvailable ? (
          <button
            type="button"
            disabled={busy || !calendar}
            onClick={() =>
              calendar?.connect().catch((error) =>
                setLocalError(error instanceof Error ? error.message : String(error)),
              )
            }
          >
            連結 Google Calendar
          </button>
        ) : selectedCalendars.length ? (
          <div className="inline-form">
            <select
              aria-label="Task Calendar"
              value={calendarId}
              onChange={(event) => setCalendarId(event.target.value)}
            >
              {selectedCalendars.map((item) => (
                <option key={item.calendar_id} value={item.calendar_id}>
                  {item.summary}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !calendarId || (!task.due_at && !task.start_date)}
              onClick={() => void createCalendarEvent(task, calendarId)}
            >
              {calendarLink?.sync_status === "failed"
                ? "重試建立事件"
                : calendarLink?.sync_status === "synced"
                  ? "確認事件關聯"
                  : "建立 Calendar event"}
            </button>
          </div>
        ) : (
          <p className="subtle">請先在 Today 同步並選擇要顯示的 Calendar。</p>
        )}
      </section>

      <section className="detail-section full-width">
        <h3>Activity / Notes</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              note.trim() &&
              (await run("add_note", {
                task_id: task.id,
                content: note.trim(),
              }))
            )
              setNote("");
          }}
        >
          <label>
            新增工作紀錄
            <textarea
              value={note}
              maxLength={20000}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button disabled={busy || !note.trim()}>新增紀錄</button>
        </form>
        <ol className="timeline">
          {notes.map((item) => (
            <li key={item.id}>
              <time>{new Date(item.created_at).toLocaleString("zh-TW")}</time>
              <p>{item.content}</p>
            </li>
          ))}
          {!notes.length && <li className="subtle">尚無工作紀錄</li>}
        </ol>
      </section>

      <section className="detail-section full-width danger-zone">
        <h3>刪除任務</h3>
        {confirmDelete ? (
          <div className="confirm">
            <p>確定刪除「{task.title}」及相關資料？此操作無法復原。</p>
            <button type="button" disabled={busy} onClick={() => void remove()}>
              確認刪除
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            刪除任務
          </button>
        )}
      </section>
      <div className="detail-footer">
        <button type="button" disabled={busy} onClick={close}>
          關閉
        </button>
      </div>
    </div>
  );
}
