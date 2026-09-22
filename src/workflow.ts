import { supabase } from "./api";

export type WorkflowStatus =
  | "queued"
  | "running"
  | "waiting_external"
  | "waiting_human"
  | "retrying"
  | "paused"
  | "failed"
  | "success"
  | "cancelled";

export type WorkflowRun = {
  id: string;
  run_code: string;
  task_id: string | null;
  title: string;
  source: string;
  project: string;
  status: WorkflowStatus;
  started_at: string | null;
  finished_at: string | null;
  current_node_id: string | null;
  executor: string;
  retry_count: number;
  error: string;
  human_required: boolean;
  output: string;
  pause_reason: string;
  created_at: string;
  updated_at: string;
};

export type WorkflowNode = {
  id: string;
  run_id: string;
  node_key: string;
  name: string;
  type: "ai" | "tool" | "test" | "human" | "system";
  status: WorkflowStatus;
  position: number;
  started_at: string | null;
  finished_at: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string;
  retry_count: number;
  tool: string;
  verification: Record<string, unknown>;
  parent_node_id: string | null;
  required: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkflowEvent = {
  id: string;
  run_id: string;
  node_id: string | null;
  event_type: string;
  title: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type WorkflowLog = {
  id: string;
  run_id: string;
  node_id: string | null;
  level: "info" | "warning" | "error";
  summary: string;
  drive_file_id: string | null;
  drive_web_view_link: string | null;
  created_at: string;
};

export type WorkflowArtifact = {
  id: string;
  run_id: string;
  node_id: string | null;
  kind:
    | "repository"
    | "issue"
    | "branch"
    | "commit"
    | "pull_request"
    | "test_result"
    | "document"
    | "file"
    | "link";
  label: string;
  url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type WorkflowHumanGate = {
  id: string;
  run_id: string;
  node_id: string | null;
  reason:
    | "product_decision"
    | "oauth"
    | "permission"
    | "destructive"
    | "mutually_exclusive_choice";
  prompt: string;
  status: "open" | "resolved" | "cancelled";
  response: string;
  created_at: string;
  resolved_at: string | null;
};

export type WorkflowState = {
  runs: WorkflowRun[];
  nodes: WorkflowNode[];
  events: WorkflowEvent[];
  logs: WorkflowLog[];
  artifacts: WorkflowArtifact[];
  human_gates: WorkflowHumanGate[];
};

export const emptyWorkflowState: WorkflowState = {
  runs: [],
  nodes: [],
  events: [],
  logs: [],
  artifacts: [],
  human_gates: [],
};

export function normalizeWorkflowState(
  value?: Partial<WorkflowState> | null,
): WorkflowState {
  return {
    runs: value?.runs ?? [],
    nodes: value?.nodes ?? [],
    events: value?.events ?? [],
    logs: value?.logs ?? [],
    artifacts: value?.artifacts ?? [],
    human_gates: value?.human_gates ?? [],
  };
}

export async function workflowCommand(
  action: string,
  payload: Record<string, unknown> = {},
) {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.rpc("workflow_command", {
    action,
    payload,
  });
  if (error) throw new Error(error.message);
  return normalizeWorkflowState(data as Partial<WorkflowState>);
}

export type WorkflowOperations = {
  run: (
    action: string,
    payload?: Record<string, unknown>,
  ) => Promise<WorkflowState>;
};

export const workflowStatusLabels: Record<WorkflowStatus, string> = {
  queued: "Queued",
  running: "Running",
  waiting_external: "Waiting External",
  waiting_human: "Waiting Human",
  retrying: "Retrying",
  paused: "Paused",
  failed: "Failed",
  success: "Success",
  cancelled: "Cancelled",
};

export function runDuration(run: WorkflowRun, now = Date.now()) {
  const start = new Date(run.started_at ?? run.created_at).getTime();
  const end = run.finished_at ? new Date(run.finished_at).getTime() : now;
  return Math.max(0, Math.floor((end - start) / 1000));
}
