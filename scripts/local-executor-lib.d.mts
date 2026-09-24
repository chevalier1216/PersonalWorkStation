export const defaultPort: number;
export function codexExecArgs(root: string, schema: string, resultFile: string): string[];
export function originAllowed(origin: string, configured?: string): boolean;
export function validateExecuteBody(value: unknown): {
  runId: string;
  accessToken: string;
  supabaseUrl: string;
  publishableKey: string;
};
export function executorPrompt(
  run: { run_code: string },
  request: string,
): string;
