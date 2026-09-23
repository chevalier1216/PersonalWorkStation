import { createClient } from "@supabase/supabase-js";
import type { GoogleCalendarEvent, Snapshot, Task } from "./domain";
import { emptyGoogleCalendarSync } from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;
export function normalizeSnapshot(snapshot: Partial<Snapshot>): Snapshot {
  return {
    columns: snapshot.columns ?? [],
    tasks: snapshot.tasks ?? [],
    tags: snapshot.tags ?? [],
    checklist: snapshot.checklist ?? [],
    notes: snapshot.notes ?? [],
    relations: snapshot.relations ?? [],
    history: snapshot.history ?? [],
    notifications: snapshot.notifications ?? [],
    preferences: snapshot.preferences ?? {
      module_order: [
        "tasks",
        "calendar",
        "ai_execution",
        "notifications",
        "holidays",
        "exchange_rates",
      ],
      hidden_modules: [],
      updated_at: "",
    },
    calendar_days: snapshot.calendar_days ?? [],
    google_calendars: snapshot.google_calendars ?? [],
    google_events: snapshot.google_events ?? [],
    task_calendar_links: snapshot.task_calendar_links ?? [],
    google_calendar_sync:
      snapshot.google_calendar_sync ?? emptyGoogleCalendarSync,
  };
}

type GoogleCalendarListItem = {
  id: string;
  summary?: string;
  backgroundColor?: string;
  timeZone?: string;
  primary?: boolean;
};
type GoogleEvent = {
  id: string;
  summary?: string;
  htmlLink?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

async function googleJson<T>(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    const hint =
      response.status === 401
        ? "Google 授權已過期，請重新連結。"
        : body.slice(0, 500);
    throw new Error(`Google Calendar API ${response.status}：${hint}`);
  }
  return (await response.json()) as T;
}

export function normalizeGoogleEvent(
  calendarId: string,
  event: GoogleEvent,
): Omit<GoogleCalendarEvent, "updated_at"> {
  const allDay = Boolean(event.start?.date);
  return {
    calendar_id: calendarId,
    event_id: event.id,
    title: event.summary?.trim() || "(無標題)",
    start_at: allDay ? null : (event.start?.dateTime ?? null),
    end_at: allDay ? null : (event.end?.dateTime ?? null),
    start_date: allDay ? (event.start?.date ?? null) : null,
    end_date: allDay ? (event.end?.date ?? null) : null,
    all_day: allDay,
    html_link: event.htmlLink ?? "",
    status: event.status === "tentative" ? "tentative" : "confirmed",
  };
}

export function taskEventBody(task: Task) {
  const privateProperties = { personalWorkStationTaskId: task.id };
  if (task.due_at) {
    const start = new Date(task.due_at);
    const end = new Date(
      start.getTime() + (task.estimated_minutes ?? 30) * 60000,
    );
    return {
      summary: task.title,
      description: task.description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      extendedProperties: { private: privateProperties },
    };
  }
  if (task.start_date) {
    const end = new Date(`${task.start_date}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return {
      summary: task.title,
      description: task.description,
      start: { date: task.start_date },
      end: { date: end.toISOString().slice(0, 10) },
      extendedProperties: { private: privateProperties },
    };
  }
  throw new Error("請先為 Task 設定開始日期或截止時間。");
}

export async function syncGoogleCalendar(
  token: string,
  current: Snapshot,
): Promise<Snapshot> {
  try {
    const list = await googleJson<{ items?: GoogleCalendarListItem[] }>(
      token,
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250",
    );
    const prior = new Map(
      current.google_calendars.map((item) => [item.calendar_id, item.selected]),
    );
    const hasPrior = current.google_calendars.length > 0;
    const calendars = (list.items ?? []).map((item) => ({
      id: item.id,
      summary: item.summary ?? "未命名 Calendar",
      color: item.backgroundColor ?? "#7895b2",
      time_zone: item.timeZone ?? "",
      is_primary: Boolean(item.primary),
      selected: prior.get(item.id) ?? (!hasPrior && Boolean(item.primary)),
    }));
    const selected = calendars.filter((item) => item.selected);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 21);
    const eventGroups = await Promise.all(
      selected.map(async (calendar) => {
        const query = new URLSearchParams({
          singleEvents: "true",
          orderBy: "startTime",
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          maxResults: "250",
        });
        const response = await googleJson<{ items?: GoogleEvent[] }>(
          token,
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${query}`,
        );
        return (response.items ?? [])
          .filter((event) => event.status !== "cancelled")
          .map((event) => normalizeGoogleEvent(calendar.id, event));
      }),
    );
    return command("calendar_sync_success", {
      calendars,
      events: eventGroups.flat(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return command("calendar_sync_failure", { message });
  }
}

export async function createTaskCalendarEvent(
  token: string,
  task: Task,
  calendarId: string,
): Promise<Snapshot> {
  try {
    const query = new URLSearchParams({
      privateExtendedProperty: `personalWorkStationTaskId=${task.id}`,
      maxResults: "1",
      singleEvents: "true",
    });
    const existing = await googleJson<{ items?: GoogleEvent[] }>(
      token,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
    );
    const event =
      existing.items?.[0] ??
      (await googleJson<GoogleEvent>(
        token,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        { method: "POST", body: JSON.stringify(taskEventBody(task)) },
      ));
    return command("calendar_link_success", {
      task_id: task.id,
      calendar_id: calendarId,
      event_id: event.id,
      html_link: event.htmlLink ?? "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return command("calendar_link_failure", {
      task_id: task.id,
      calendar_id: calendarId,
      message,
    });
  }
}
export async function command(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<Snapshot> {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.rpc("workspace_command", {
    action,
    payload,
  });
  if (error) throw new Error(error.message);
  return normalizeSnapshot(data as Partial<Snapshot>);
}
