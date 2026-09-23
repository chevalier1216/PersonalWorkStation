import type { WorkflowState } from "./workflow";
import { workflowCommand } from "./workflow";

export type LocalExecutorOperations = {
  execute: (runId: string) => Promise<WorkflowState>;
};

export function createLocalExecutor(options: {
  accessToken: string;
  supabaseUrl: string;
  publishableKey: string;
  bridgeUrl?: string;
}): LocalExecutorOperations {
  const bridgeUrl = options.bridgeUrl ?? "http://127.0.0.1:4317";
  return {
    async execute(runId) {
      const response = await fetch(`${bridgeUrl}/execute`, {
        method: "POST",
        targetAddressSpace: "loopback",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId,
          accessToken: options.accessToken,
          supabaseUrl: options.supabaseUrl,
          publishableKey: options.publishableKey,
        }),
      } as RequestInit & { targetAddressSpace: "loopback" });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          body.error ??
            "無法連接本機 Executor。請先執行 npm run executor:local。",
        );
      return workflowCommand("load");
    },
  };
}
