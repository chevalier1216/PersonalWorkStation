export interface WorkerIssue {
  number: number;
  title: string;
  body?: string;
  state?: string;
  labels?: Array<string | { name?: string }>;
}

export const CODEX_LABELS: Readonly<{
  ready: string;
  running: string;
  blocked: string;
  done: string;
}>;
export const SUPPORTED_REPOSITORIES: Readonly<Record<string, unknown>>;
export function labelNames(issue: WorkerIssue): Set<string>;
export function isReadyIssue(issue: WorkerIssue): boolean;
export function selectReadyIssue(
  issues: WorkerIssue[],
): WorkerIssue | undefined;
export function slugify(value: unknown, maxLength?: number): string;
export function issueBranch(issue: WorkerIssue): string;
export function repoStateKey(nameWithOwner: string): string;
export function validateWorkerConfig(
  config: unknown,
  configPath?: string,
): {
  workerName: string;
  maxAttempts: number;
  staleAfterMinutes: number;
  repositories: Array<{
    nameWithOwner: string;
    repositoryRoot: string;
    baseBranch: string;
  }>;
};
export function buildCodexPrompt(options: {
  repository: {
    nameWithOwner: string;
    repositoryRoot: string;
    baseBranch: string;
  };
  issue: WorkerIssue;
  branch: string;
  attempt: number;
  recovery: boolean;
}): string;
export function classifyHumanGate(errorText: unknown): boolean;
export function sanitizeForLog(value: unknown): string;
export function resultComment(options: Record<string, unknown>): string;
export function blockedComment(reason: unknown): string;
export function acquireLease(
  lockPath: string,
  staleAfterMinutes: number,
  now?: Date,
): Promise<{
  acquired: boolean;
  recovered: boolean;
  payload: Record<string, unknown>;
  stalePath?: string;
}>;
export function releaseLease(lockPath: string): Promise<void>;
export function saveRunState(path: string, state: unknown): Promise<void>;
export function loadRunState(
  path: string,
): Promise<Record<string, unknown> | null>;
export function assertCodexResult(result: unknown): Record<string, unknown>;
export function executableName(path: string): string;
