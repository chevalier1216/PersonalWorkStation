import { supabase } from "./api";

export type SearchField =
  | "all"
  | "title"
  | "description"
  | "notes"
  | "deliverable"
  | "tags"
  | "priority"
  | "status"
  | "date"
  | "calendar"
  | "chat"
  | "summary";

export type SearchResult = {
  result_type: "task" | "note" | "chat" | "summary";
  matched_field: SearchField;
  result_id: string;
  result_title: string;
  snippet: string;
  task_id: string | null;
  note_id: string | null;
  conversation_id: string | null;
  summary_id: string | null;
  occurred_at: string;
};

export const searchFieldLabels: Record<SearchField, string> = {
  all: "全部欄位",
  title: "標題",
  description: "說明",
  notes: "Activity / Notes",
  deliverable: "交付物",
  tags: "標籤",
  priority: "優先程度",
  status: "狀態",
  date: "日期",
  calendar: "Calendar 關聯",
  chat: "AI 對話",
  summary: "AI Summary",
};

export async function historySearch(query: string, field: SearchField) {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.rpc("history_search", {
    search_text: query,
    search_field: field,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SearchResult[];
}

export type SearchOperations = {
  search: (query: string, field: SearchField) => Promise<SearchResult[]>;
};
