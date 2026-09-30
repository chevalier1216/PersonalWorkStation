import { createClient } from "@supabase/supabase-js";
import type {
  GoogleCalendarEvent,
  Snapshot,
  StandaloneCalendarEventInput,
  StandaloneCalendarEventResult,
  Task,
} from "./domain";
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

export function calendarSyncEnd(start: Date) {
  return new Date(start.getFullYear(), start.getMonth() + 2, 1);
}

export async function listGoogleEvents(
  token: string,
  calendarId: string,
  start: Date,
  end: Date,
) {
  const query = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    maxResults: "250",
  });
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    if (++pages > 40)
      throw new Error("Google Calendar 行程過多，單次同步超過 40 頁上限。");
    if (pageToken) query.set("pageToken", pageToken);
    const response = await googleJson<{
      items?: GoogleEvent[];
      nextPageToken?: string;
    }>(
      token,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
    );
    events.push(...(response.items ?? []));
    pageToken = response.nextPageToken;
  } while (pageToken);
  return events
    .filter((event) => event.status !== "cancelled")
    .map((event) => normalizeGoogleEvent(calendarId, event));
}

type CalendarCredentialStatus = {
  available: boolean;
  needs_reconnect: boolean;
  last_error: string;
};

async function calendarEdgeRequest<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.functions.invoke("google-calendar", {
    body: { action, ...payload },
  });
  if (error) {
    let message = error.message;
    const context = (error as unknown as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // Keep the Supabase Functions error when the response is not JSON.
      }
    }
    throw new Error(message);
  }
  return data as T;
}

export function getGoogleCalendarCredentialStatus() {
  return calendarEdgeRequest<CalendarCredentialStatus>("status");
}

export function storeGoogleCalendarCredentials(
  accessToken?: string | null,
  refreshToken?: string | null,
) {
  return calendarEdgeRequest<CalendarCredentialStatus>("store_credentials", {
    google_access_token: accessToken ?? "",
    google_refresh_token: refreshToken ?? "",
  });
}

export async function syncGoogleCalendar(): Promise<Snapshot> {
  const data = await calendarEdgeRequest<{ snapshot: Partial<Snapshot> }>(
    "sync",
  );
  return normalizeSnapshot(data.snapshot);
}

export async function createTaskCalendarEvent(
  task: Task,
  calendarId: string,
): Promise<Snapshot> {
  const data = await calendarEdgeRequest<{ snapshot: Partial<Snapshot> }>(
    "create_task_event",
    { task, calendar_id: calendarId },
  );
  return normalizeSnapshot(data.snapshot);
}

export async function createStandaloneCalendarEvent(
  input: StandaloneCalendarEventInput,
): Promise<StandaloneCalendarEventResult> {
  const data = await calendarEdgeRequest<
    Omit<StandaloneCalendarEventResult, "snapshot"> & {
      snapshot: Partial<Snapshot>;
    }
  >("create_event", input);
  return { ...data, snapshot: normalizeSnapshot(data.snapshot) };
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
