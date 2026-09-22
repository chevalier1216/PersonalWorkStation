import { supabase } from "./api";

export type AISummary = {
  id: string;
  task_id: string;
  previous_summary_id: string | null;
  latest_summary_id: string | null;
  version_label: string;
  title: string;
  decisions: string[];
  completed: string[];
  cancelled: string[];
  superseded: string[];
  content: string;
  created_at: string;
};

export type SummaryState = { summaries: AISummary[] };
export const emptySummaryState: SummaryState = { summaries: [] };

const genericSummaryTitles = new Set(["摘要", "進度整理", "工作摘要"]);

export function validateSummaryTitle(value: string): string {
  const title = value.trim();
  if (!title) return "請輸入 Summary 標題";
  if (genericSummaryTitles.has(title))
    return "請使用具體且有意義的 Summary 標題";
  return "";
}

export function normalizeSummaryState(
  value?: Partial<SummaryState> | null,
): SummaryState {
  return { summaries: value?.summaries ?? [] };
}

export async function summaryCommand(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<SummaryState> {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.rpc("summary_command", {
    action,
    payload,
  });
  if (error) throw new Error(error.message);
  return normalizeSummaryState(data as Partial<SummaryState>);
}

export type SummaryOperations = {
  load: () => Promise<SummaryState>;
  create: (
    taskId: string,
    draft: {
      title: string;
      decisions: string[];
      completed: string[];
      cancelled: string[];
      superseded: string[];
      content: string;
    },
  ) => Promise<SummaryState>;
};
