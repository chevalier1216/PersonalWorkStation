import { useEffect, useRef, useState, type FormEvent } from "react";
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
import {
  emptySummaryState,
  type AISummary,
  type SummaryOperations,
  validateSummaryTitle,
} from "./summary";
import {
  emptyAttachmentState,
  type Attachment,
  type AttachmentOperations,
} from "./attachments";
import { workflowStatusLabels, type WorkflowRun } from "./workflow";

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

function summaryLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
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
  summaries,
  initialNoteId,
  initialSummaryId,
  attachments,
  workflowRuns,
  openRun,
  openTask,
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
  summaries?: SummaryOperations;
  initialNoteId?: string;
  initialSummaryId?: string;
  attachments?: AttachmentOperations;
  workflowRuns: WorkflowRun[];
  openRun: (id: string) => void;
  openTask: (id: string) => void;
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
  const [summaryState, setSummaryState] = useState(emptySummaryState);
  const [summaryBusy, setSummaryBusy] = useState(Boolean(summaries));
  const [summaryError, setSummaryError] = useState("");
  const [summaryTitle, setSummaryTitle] = useState("");
  const [summaryContent, setSummaryContent] = useState("");
  const [summaryDecisions, setSummaryDecisions] = useState("");
  const [summaryCompleted, setSummaryCompleted] = useState("");
  const [summaryCancelled, setSummaryCancelled] = useState("");
  const [summarySuperseded, setSummarySuperseded] = useState("");
  const [attachmentState, setAttachmentState] = useState(emptyAttachmentState);
  const [attachmentBusy, setAttachmentBusy] = useState(Boolean(attachments));
  const [attachmentError, setAttachmentError] = useState("");
  const archiveInFlight = useRef(new Set<string>());
  const [folderLinks, setFolderLinks] = useState<Record<string, string>>({});
  const [relationType, setRelationType] =
    useState<RelationType>("prerequisite");
  const [relatedTask, setRelatedTask] = useState("");
  const [relationReason, setRelationReason] = useState("");
  const calendarLink = data.task_calendar_links.find(
    (item) => item.task_id === task.id,
  );
  const selectedCalendars = data.google_calendars.filter(
    (item) => item.selected,
  );
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
  const taskSummaries = summaryState.summaries
    .filter((item) => item.task_id === task.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const taskAttachments = attachmentState.attachments.filter(
    (item) => item.task_id === task.id,
  );

  useEffect(() => {
    if (!summaries) {
      setSummaryBusy(false);
      return;
    }
    let cancelled = false;
    setSummaryBusy(true);
    summaries
      .load()
      .then((state) => {
        if (!cancelled) setSummaryState(state);
      })
      .catch((reason) => {
        if (!cancelled)
          setSummaryError(
            reason instanceof Error ? reason.message : String(reason),
          );
      })
      .finally(() => {
        if (!cancelled) setSummaryBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [summaries]);

  useEffect(() => {
    if (!attachments) {
      setAttachmentBusy(false);
      return;
    }
    let cancelled = false;
    setAttachmentBusy(true);
    attachments
      .load()
      .then((state) => {
        if (!cancelled) setAttachmentState(state);
      })
      .catch((reason) => {
        if (!cancelled)
          setAttachmentError(
            reason instanceof Error ? reason.message : String(reason),
          );
      })
      .finally(() => {
        if (!cancelled) setAttachmentBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  useEffect(() => {
    const id = initialNoteId
      ? `note-${initialNoteId}`
      : initialSummaryId
        ? `summary-${initialSummaryId}`
        : "";
    if (!id) return;
    const timer = window.setTimeout(
      () => document.getElementById(id)?.scrollIntoView({ block: "center" }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [initialNoteId, initialSummaryId, summaryState]);

  function differenceList(label: string, values: string[]) {
    if (!values.length) return null;
    return (
      <div className="summary-difference">
        <strong>{label}</strong>
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      </div>
    );
  }

  function latestFor(summary: AISummary) {
    return summaryState.summaries.find(
      (item) => item.id === summary.latest_summary_id,
    );
  }

  async function uploadFiles(files: FileList | null, noteId?: string) {
    if (!attachments || !files?.length) return;
    setAttachmentBusy(true);
    setAttachmentError("");
    try {
      let state = attachmentState;
      for (const file of Array.from(files))
        state = await attachments.upload(task.id, file, noteId);
      setAttachmentState(state);
    } catch (reason) {
      setAttachmentError(
        reason instanceof Error ? reason.message : String(reason),
      );
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function openFile(attachment: Attachment) {
    if (!attachments) return;
    setAttachmentError("");
    try {
      const url = await attachments.open(attachment);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setAttachmentError(
        reason instanceof Error ? reason.message : String(reason),
      );
    }
  }

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
      recurrence_interval: recurrenceType
        ? Number(recurrenceInterval || 1)
        : null,
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
                onChange={(e) =>
                  setRecurrenceUnit(e.target.value as RecurrenceUnit)
                }
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
              <button
                type="button"
                className="relation-task-link"
                onClick={() => openTask(item.related_task_id)}
              >
                {taskName(item.related_task_id)}
              </button>
              {item.reason && <small>{item.reason}</small>}
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
                reason: relationReason.trim(),
              }))
            ) {
              setRelatedTask("");
              setRelationReason("");
            }
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
          <input
            aria-label="阻擋原因（選填）"
            value={relationReason}
            maxLength={2000}
            placeholder="例如：等待前置驗證"
            onChange={(event) => setRelationReason(event.target.value)}
          />
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
              <>
                {" "}
                ·{" "}
                <a
                  href={calendarLink.html_link}
                  target="_blank"
                  rel="noreferrer"
                >
                  開啟事件
                </a>
              </>
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
              calendar
                ?.connect()
                .catch((error) =>
                  setLocalError(
                    error instanceof Error ? error.message : String(error),
                  ),
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
              disabled={
                busy || !calendarId || (!task.due_at && !task.start_date)
              }
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
        <h3>AI Execution</h3>
        <p className="subtle">
          Task 可關聯多個 Run；執行細節統一在 AI 執行中心查看。
        </p>
        <ol className="task-run-list">
          {workflowRuns.map((run) => (
            <li key={run.id}>
              <button type="button" onClick={() => openRun(run.id)}>
                <code>{run.run_code}</code>
                <strong>{run.title}</strong>
                <span>{workflowStatusLabels[run.status]}</span>
              </button>
            </li>
          ))}
          {!workflowRuns.length && <li className="subtle">尚無關聯 Run</li>}
        </ol>
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
            <li
              id={`note-${item.id}`}
              className={initialNoteId === item.id ? "search-hit" : undefined}
              key={item.id}
            >
              <time>{new Date(item.created_at).toLocaleString("zh-TW")}</time>
              <p>{item.content}</p>
              <label className="note-attachment">
                附加檔案
                <input
                  type="file"
                  multiple
                  disabled={!attachments || attachmentBusy}
                  onChange={(event) => {
                    void uploadFiles(event.target.files, item.id);
                    event.target.value = "";
                  }}
                />
              </label>
            </li>
          ))}
          {!notes.length && <li className="subtle">尚無工作紀錄</li>}
        </ol>
      </section>

      <section className="detail-section full-width attachment-section">
        <div className="module-heading">
          <div>
            <h3>附件與封存</h3>
            <p className="subtle">
              附件可留在私人 Storage，或驗證完成後封存至 Google Drive。
            </p>
          </div>
          {attachments?.reconnect && (
            <button
              type="button"
              disabled={attachmentBusy}
              onClick={() =>
                void attachments.reconnect!().catch((reason) =>
                  setAttachmentError(
                    reason instanceof Error ? reason.message : String(reason),
                  ),
                )
              }
            >
              重新連結 Google Drive
            </button>
          )}
          <label className="file-button">
            {attachmentBusy ? "處理中…" : "新增附件"}
            <input
              aria-label="新增附件"
              type="file"
              multiple
              disabled={!attachments || attachmentBusy}
              onChange={(event) => {
                void uploadFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        {attachmentError && (
          <p className="error" role="alert">
            {attachmentError}
          </p>
        )}
        <ul className="attachment-list">
          {taskAttachments.map((attachment) => (
            <li key={attachment.id}>
              <div>
                <strong>{attachment.filename}</strong>
                <span>
                  {(attachment.size_bytes / 1024).toFixed(1)} KB ·{" "}
                  {attachment.note_id ? "Activity 附件" : "Task 附件"}
                </span>
                {attachment.drive_path && <span>{attachment.drive_path}</span>}
                {attachment.archive_error && (
                  <span className="attachment-failure">
                    {attachment.archive_error}
                  </span>
                )}
              </div>
              <span className={`archive-status ${attachment.archive_status}`}>
                {attachment.archive_status === "archived"
                  ? "已封存"
                  : attachment.archive_status === "failed"
                    ? "封存失敗"
                    : attachment.archive_status === "archiving"
                      ? "封存中"
                      : "使用中"}
              </span>
              <button
                type="button"
                disabled={!attachments || attachmentBusy}
                onClick={() => void openFile(attachment)}
              >
                開啟
              </button>
              {attachment.drive_file_id &&
                (folderLinks[attachment.id] ? (
                  <a
                    href={folderLinks[attachment.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    開啟所在資料夾
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={!attachments || attachmentBusy}
                    onClick={async () => {
                      if (!attachments) return;
                      setAttachmentBusy(true);
                      setAttachmentError("");
                      try {
                        const url = await attachments.folder(attachment.id);
                        setFolderLinks((links) => ({
                          ...links,
                          [attachment.id]: url,
                        }));
                      } catch (reason) {
                        setAttachmentError(
                          reason instanceof Error
                            ? reason.message
                            : String(reason),
                        );
                      } finally {
                        setAttachmentBusy(false);
                      }
                    }}
                  >
                    取得所在資料夾連結
                  </button>
                ))}
              {attachment.archive_status !== "archived" && (
                <button
                  type="button"
                  disabled={
                    !attachments ||
                    attachmentBusy ||
                    attachment.archive_status === "archiving"
                  }
                  onClick={async () => {
                    if (
                      !attachments ||
                      archiveInFlight.current.has(attachment.id)
                    )
                      return;
                    archiveInFlight.current.add(attachment.id);
                    setAttachmentBusy(true);
                    setAttachmentError("");
                    try {
                      setAttachmentState(
                        await attachments.archive(attachment.id),
                      );
                    } catch (reason) {
                      setAttachmentError(
                        reason instanceof Error
                          ? reason.message
                          : String(reason),
                      );
                      setAttachmentState(await attachments.load());
                    } finally {
                      archiveInFlight.current.delete(attachment.id);
                      setAttachmentBusy(false);
                    }
                  }}
                >
                  {attachment.archive_status === "failed"
                    ? "重試封存"
                    : "封存至 Drive"}
                </button>
              )}
            </li>
          ))}
          {!attachmentBusy && !taskAttachments.length && (
            <li className="subtle">尚無附件</li>
          )}
        </ul>
      </section>

      <section className="detail-section full-width summary-section">
        <div className="module-heading">
          <div>
            <h3>AI Summary</h3>
            <p className="subtle">
              來源 Task：{task.title}。Summary 獨立保存，不覆寫原 Task。
            </p>
          </div>
        </div>
        <p className="subtle">
          ChatGPT 對話操作尚未接通，入口暫停。仍可在下方手動建立 Summary。
        </p>
        {summaryError && (
          <p className="error" role="alert">
            {summaryError}
          </p>
        )}
        <form
          className="summary-import"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!summaryTitle.trim() || !summaryContent.trim()) return;
            const titleError = validateSummaryTitle(summaryTitle);
            if (titleError) {
              setSummaryError(titleError);
              return;
            }
            setSummaryBusy(true);
            setSummaryError("");
            try {
              const payload = {
                title: summaryTitle.trim(),
                decisions: summaryLines(summaryDecisions),
                completed: summaryLines(summaryCompleted),
                cancelled: summaryLines(summaryCancelled),
                superseded: summaryLines(summarySuperseded),
                content: summaryContent.trim(),
              };
              const created = await run("create_summary_task", {
                task_id: task.id,
                title: payload.title,
                decisions: summaryDecisions.trim(),
                completed: summaryCompleted.trim(),
                cancelled: summaryCancelled.trim(),
                superseded: summarySuperseded.trim(),
                content: payload.content,
              });
              if (!created) return;
              if (summaries)
                setSummaryState(await summaries.create(task.id, payload));
              setSummaryTitle("");
              setSummaryContent("");
              setSummaryDecisions("");
              setSummaryCompleted("");
              setSummaryCancelled("");
              setSummarySuperseded("");
            } catch (reason) {
              setSummaryError(
                reason instanceof Error ? reason.message : String(reason),
              );
            } finally {
              setSummaryBusy(false);
            }
          }}
        >
          <div className="field-row">
            <label>
              Summary 標題
              <input
                value={summaryTitle}
                maxLength={300}
                onChange={(event) => setSummaryTitle(event.target.value)}
              />
            </label>
            <label>
              已完成（每行一項）
              <textarea
                value={summaryCompleted}
                onChange={(event) => setSummaryCompleted(event.target.value)}
              />
            </label>
          </div>
          <div className="field-row">
            <label>
              與上一版不同的決策（每行一項）
              <textarea
                value={summaryDecisions}
                onChange={(event) => setSummaryDecisions(event.target.value)}
              />
            </label>
            <label>
              已取消（每行一項）
              <textarea
                value={summaryCancelled}
                onChange={(event) => setSummaryCancelled(event.target.value)}
              />
            </label>
            <label>
              已取代（每行一項）
              <textarea
                value={summarySuperseded}
                onChange={(event) => setSummarySuperseded(event.target.value)}
              />
            </label>
          </div>
          <label>
            完整摘要
            <textarea
              value={summaryContent}
              maxLength={50000}
              onChange={(event) => setSummaryContent(event.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={
              summaryBusy || !summaryTitle.trim() || !summaryContent.trim()
            }
          >
            {summaryBusy ? "建立中…" : "建立摘要任務卡"}
          </button>
        </form>
        <ol className="summary-timeline">
          {taskSummaries.map((summary) => {
            const latest = latestFor(summary);
            return (
              <li
                id={`summary-${summary.id}`}
                className={
                  initialSummaryId === summary.id
                    ? "summary-card search-hit"
                    : "summary-card"
                }
                key={summary.id}
              >
                {latest && (
                  <button
                    className="latest-summary-link"
                    onClick={() =>
                      document
                        .getElementById(`summary-${latest.id}`)
                        ?.scrollIntoView({ block: "center" })
                    }
                  >
                    最新版本：{latest.version_label} · {latest.title}
                  </button>
                )}
                <div className="summary-heading">
                  <strong>{summary.title}</strong>
                  <span>{summary.version_label}</span>
                </div>
                {differenceList("與上一版不同的決策", summary.decisions)}
                {differenceList("已完成", summary.completed)}
                {differenceList("已取消", summary.cancelled)}
                {differenceList("已取代", summary.superseded)}
                <p>{summary.content}</p>
                <time>
                  {new Date(summary.created_at).toLocaleString("zh-TW")}
                </time>
              </li>
            );
          })}
          {!summaryBusy && !taskSummaries.length && (
            <li className="subtle">尚無 Summary 版本</li>
          )}
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
