export const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const rfc3339WithOffset =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export type StandaloneEventInput = {
  title: string;
  start_at: string;
  end_at: string;
  timezone: string;
  description: string;
};

export function validateTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeStandaloneEvent(
  value: Record<string, unknown>,
): StandaloneEventInput {
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const startAt =
    typeof value.start_at === "string" ? value.start_at.trim() : "";
  const endAt = typeof value.end_at === "string" ? value.end_at.trim() : "";
  const timezone =
    typeof value.timezone === "string" && value.timezone.trim()
      ? value.timezone.trim()
      : "Asia/Taipei";
  const description =
    typeof value.description === "string" ? value.description : "";
  if (!title || title.length > 300)
    throw new Error("行程標題必須為 1 至 300 字");
  if (description.length > 20000) throw new Error("行程說明最多 20000 字");
  if (!rfc3339WithOffset.test(startAt) || !Number.isFinite(Date.parse(startAt)))
    throw new Error("開始時間必須是包含 UTC offset 的 RFC 3339 日期時間");
  if (!validateTimeZone(timezone))
    throw new Error("timezone 必須是有效的 IANA 時區");
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + 30 * 60000);
  if (
    endAt &&
    (!rfc3339WithOffset.test(endAt) || !Number.isFinite(end.getTime()))
  )
    throw new Error("結束時間必須是包含 UTC offset 的 RFC 3339 日期時間");
  if (end <= start) throw new Error("結束時間必須晚於開始時間");
  return {
    title,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    timezone,
    description,
  };
}

export function standaloneEventBody(
  input: StandaloneEventInput,
  requestKey: string,
) {
  return {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.start_at, timeZone: input.timezone },
    end: { dateTime: input.end_at, timeZone: input.timezone },
    extendedProperties: {
      private: { personalWorkStationRequestKey: requestKey },
    },
  };
}

export function taskEventBody(value: Record<string, unknown>) {
  const id = typeof value.id === "string" ? value.id : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description =
    typeof value.description === "string" ? value.description : "";
  if (!id || !title) throw new Error("Task Calendar 資料不完整");
  if (typeof value.due_at === "string" && value.due_at) {
    const start = new Date(value.due_at);
    if (!Number.isFinite(start.getTime())) throw new Error("Task 截止時間無效");
    const estimate =
      typeof value.estimated_minutes === "number" &&
      Number.isInteger(value.estimated_minutes) &&
      value.estimated_minutes > 0
        ? value.estimated_minutes
        : 30;
    return {
      summary: title,
      description,
      start: { dateTime: start.toISOString() },
      end: {
        dateTime: new Date(start.getTime() + estimate * 60000).toISOString(),
      },
      extendedProperties: { private: { personalWorkStationTaskId: id } },
    };
  }
  if (
    typeof value.start_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.start_date)
  ) {
    const end = new Date(`${value.start_date}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return {
      summary: title,
      description,
      start: { date: value.start_date },
      end: { date: end.toISOString().slice(0, 10) },
      extendedProperties: { private: { personalWorkStationTaskId: id } },
    };
  }
  throw new Error("請先為 Task 設定開始日期或截止時間");
}

export async function requestKey(ownerId: string, input: StandaloneEventInput) {
  const bytes = new TextEncoder().encode(
    JSON.stringify([
      ownerId,
      input.title,
      input.start_at,
      input.end_at,
      input.timezone,
      input.description,
    ]),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function normalizeGoogleEvent(calendarId: string, event: GoogleEvent) {
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

export type GoogleEvent = {
  id: string;
  summary?: string;
  htmlLink?: string;
  status?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};

export type GoogleCalendar = {
  id: string;
  summary?: string;
  backgroundColor?: string;
  timeZone?: string;
  primary?: boolean;
};

export function googleErrorMessage(status: number, body: unknown) {
  const value = body as { error?: { message?: string; status?: string } };
  return (
    value?.error?.message ??
    value?.error?.status ??
    `Google Calendar HTTP ${status}`
  );
}
