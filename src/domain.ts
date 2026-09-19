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
  position: number;
  completed_at: string | null;
  created_at: string;
}
export interface Snapshot {
  columns: Column[];
  tasks: Task[];
}
export const taskInput = z.object({
  title: z.string().trim().min(1, "請輸入任務標題").max(300, "標題最多 300 字"),
  description: z.string().max(20000),
  priority: z.enum(["Regular", "High", "Urgent"]),
  due_at: z.string().datetime().nullable(),
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
