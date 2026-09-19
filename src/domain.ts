import { z } from "zod";
export type Kind = "todo" | "doing" | "done";
export type Priority = "Regular" | "High" | "Urgent";
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
export interface Snapshot {
  columns: Column[];
  tasks: Task[];
  tags: TaskTag[];
  checklist: ChecklistItem[];
  notes: TaskNote[];
  relations: TaskRelation[];
  history: StatusHistory[];
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
