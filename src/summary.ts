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

export async function generateAISummary(taskId: string): Promise<SummaryState> {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.functions.invoke("ai-summary", {
    body: { task_id: taskId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return normalizeSummaryState(data as Partial<SummaryState>);
}

export type SummaryOperations = {
  load: () => Promise<SummaryState>;
  generate: (taskId: string) => Promise<SummaryState>;
};
