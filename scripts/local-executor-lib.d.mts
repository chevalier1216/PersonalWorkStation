export const defaultPort: number;
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
