import { useMemo, useState } from "react";
import type { GoogleCalendarEvent, Snapshot } from "./domain";
import type { CalendarOperations } from "./Board";
import { CalendarAgenda } from "./Today";

type Run = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<boolean>;

export function CalendarView({
  data,
  busy,
  calendar,
  run,
  syncCalendar,
  openTask,
  createCalendarRun,
}: {
  data: Snapshot;
  busy: boolean;
  calendar?: CalendarOperations;
  run: Run;
  syncCalendar: () => Promise<boolean>;
  openTask: (id: string) => void;
  createCalendarRun: (event: GoogleCalendarEvent) => Promise<boolean>;
}) {
  const [editingCalendars, setEditingCalendars] = useState(false);
  const dates = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, []);
  const incomplete = data.tasks.filter((task) => {
    const column = data.columns.find((item) => item.id === task.column_id);
    return column?.kind !== "done";
  });
  const selected = data.google_calendars.filter((item) => item.selected);

  return (
    <section className="calendar-view" aria-label="行事曆">
      <div className="heading">
        <div>
          <p className="eyebrow">GOOGLE CALENDAR</p>
          <h1>行事曆</h1>
          <p className="muted">
            顯示工作臺 Task 與已選取的 Google Calendar 行程。
          </p>
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
                <button disabled={busy} onClick={() => void calendar.connect()}>
                  重新連結
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => setEditingCalendars((value) => !value)}
              >
                選擇 Calendar（{selected.length}）
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
                  void run("calendar_set_selections", { calendar_ids: ids });
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
        dates={dates}
        data={data}
        tasks={incomplete}
        openTask={openTask}
        createCalendarRun={createCalendarRun}
      />
    </section>
  );
}
