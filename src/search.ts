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
  | "summary"
  | "attachments";

export type SearchResult = {
  result_type: "task" | "note" | "summary" | "attachment";
  matched_field: SearchField;
  result_id: string;
  result_title: string;
  snippet: string;
  task_id: string | null;
  note_id: string | null;
  conversation_id: string | null;
  summary_id: string | null;
  attachment_id?: string | null;
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
  summary: "AI Summary",
  attachments: "附件與封存",
};

export async function historySearch(query: string, field: SearchField) {
  if (!supabase) throw new Error("尚未設定資料連線");
  const history =
    field === "attachments"
      ? { data: [] as SearchResult[], error: null }
      : await supabase.rpc("history_search", {
          search_text: query,
          search_field: field,
        });
  if (history.error) throw new Error(history.error.message);
  const archive =
    field === "all" || field === "attachments"
      ? await supabase.rpc("archive_search", { search_text: query })
      : { data: [] as SearchResult[], error: null };
  if (archive.error) throw new Error(archive.error.message);
  return ([...(history.data ?? []), ...(archive.data ?? [])] as SearchResult[])
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 100);
}

export type SearchOperations = {
  search: (query: string, field: SearchField) => Promise<SearchResult[]>;
};
