import { z } from "zod";
export type Kind = "todo" | "doing" | "done";
export type Priority = "Regular" | "High" | "Urgent";
export type RecurrenceType = "daily" | "weekly" | "monthly" | "custom";
export type RecurrenceUnit = "day" | "week" | "month";
export interface Column {
  id: string;
  title: string;
  kind: Kind;
  position: number;
}
export interface Task {
  id: string;
  column_id: string;
  title: string;
  description: string;
  priority: Priority;
  due_at: string | null;
  start_date: string | null;
  estimated_minutes: number | null;
  deliverable_type: string | null;
  deliverable_value: string | null;
  recurrence_type: RecurrenceType | null;
  recurrence_interval: number | null;
  recurrence_unit: RecurrenceUnit | null;
  recurrence_source_id: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
}
export interface TaskTag {
  id: string;
  task_id: string;
  name: string;
  color: string;
}
export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  position: number;
}
export interface TaskNote {
  id: string;
  task_id: string;
  content: string;
  created_at: string;
}
export type RelationType = "prerequisite" | "follow_up" | "related";
export interface TaskRelation {
  id: string;
  task_id: string;
  related_task_id: string;
  relation_type: RelationType;
}
export interface StatusHistory {
  id: string;
  task_id: string;
  from_kind: Kind | null;
  to_kind: Kind;
  changed_at: string;
}
export interface Notification {
  id: string;
  type:
    | "recurring_created"
    | "task_unblocked"
    | "unscheduled_reminder"
    | "calendar_failure"
    | "archive_failure"
    | "holiday_reminder"
    | "system";
  title: string;
  body: string;
  task_id: string | null;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
}
export interface TodayPreferences {
  module_order: Array<"tasks" | "calendar" | "ai_chat" | "notifications" | "holidays">;
  hidden_modules: Array<"tasks" | "calendar" | "ai_chat" | "notifications" | "holidays">;
  updated_at: string;
}
export interface CalendarDay {
  region: "CN" | "TW";
  day: string;
  day_type: "holiday" | "workday";
  name: string;
  source_url: string;
  fetched_at: string;
}
export interface GoogleCalendar {
  calendar_id: string;
  summary: string;
  color: string;
  time_zone: string;
  is_primary: boolean;
  selected: boolean;
  updated_at: string;
}
export interface GoogleCalendarEvent {
  calendar_id: string;
  event_id: string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  start_date: string | null;
  end_date: string | null;
  all_day: boolean;
  html_link: string;
  status: "confirmed" | "tentative";
  updated_at: string;
}
export interface TaskCalendarLink {
  id: string;
  task_id: string;
  calendar_id: string;
  event_id: string | null;
  html_link: string;
  sync_status: "synced" | "failed";
  sync_error: string;
  last_synced_at: string | null;
  created_at: string;
}
export interface GoogleCalendarSyncState {
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string;
}
export interface Snapshot {
  columns: Column[];
  tasks: Task[];
  tags: TaskTag[];
  checklist: ChecklistItem[];
  notes: TaskNote[];
  relations: TaskRelation[];
  history: StatusHistory[];
  notifications: Notification[];
  preferences: TodayPreferences;
  calendar_days: CalendarDay[];
  google_calendars: GoogleCalendar[];
  google_events: GoogleCalendarEvent[];
  task_calendar_links: TaskCalendarLink[];
  google_calendar_sync: GoogleCalendarSyncState;
}
export const taskInput = z.object({
  title: z.string().trim().min(1, "請輸入任務標題").max(300, "標題最多 300 字"),
  description: z.string().max(20000),
  priority: z.enum(["Regular", "High", "Urgent"]),
  due_at: z.string().datetime().nullable(),
  start_date: z.string().date().nullable(),
  estimated_minutes: z.number().int().min(1).max(525600).nullable(),
  deliverable_type: z.string().trim().max(40).nullable(),
  deliverable_value: z.string().trim().max(5000).nullable(),
  recurrence_type: z
    .enum(["daily", "weekly", "monthly", "custom"])
    .nullable()
    .optional(),
  recurrence_interval: z.number().int().min(1).max(365).nullable().optional(),
  recurrence_unit: z.enum(["day", "week", "month"]).nullable().optional(),
});
export const priorityLabels: Record<Priority, string> = {
  Regular: "一般",
  High: "重要",
  Urgent: "緊急",
};
export const kindLabels: Record<Kind, string> = {
  todo: "未開始",
  doing: "進行中",
  done: "已完成",
};
export function sortedTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.position - b.position || a.created_at.localeCompare(b.created_at),
  );
}
export const relationLabels: Record<RelationType, string> = {
  prerequisite: "前置任務",
  follow_up: "後續任務",
  related: "相關任務",
};
export const recurrenceLabels: Record<RecurrenceType, string> = {
  daily: "每天",
  weekly: "每週",
  monthly: "每月",
  custom: "自訂",
};

export const emptyPreferences: TodayPreferences = {
  module_order: ["tasks", "calendar", "notifications", "holidays"],
  hidden_modules: [],
  updated_at: "",
};

export const emptyGoogleCalendarSync: GoogleCalendarSyncState = {
  last_attempt_at: null,
  last_success_at: null,
  last_error: "",
};

export function rawDoingMinutes(
  history: StatusHistory[],
  taskId: string,
  now = Date.now(),
): number {
  const events = history
    .filter((item) => item.task_id === taskId)
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  let entered: number | null = null;
  let elapsed = 0;
  for (const event of events) {
    const at = new Date(event.changed_at).getTime();
    if (event.to_kind === "doing") entered = at;
    else if (entered !== null) {
      elapsed += Math.max(0, at - entered);
      entered = null;
    }
  }
  if (entered !== null) elapsed += Math.max(0, now - entered);
  return Math.floor(elapsed / 60000);
}
