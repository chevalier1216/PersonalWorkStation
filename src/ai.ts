import { supabase } from "./api";

export type AIConversation = {
  id: string;
  title: string;
  openai_conversation_id: string | null;
  last_error: string;
  created_at: string;
  updated_at: string;
};
export type AIMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};
export type AIPendingAction = {
  id: string;
  conversation_id: string;
  action_type: "edit_task" | "delete_task" | "calendar_relation";
  label: string;
  payload: Record<string, unknown>;
  status: "pending" | "confirmed" | "cancelled" | "failed";
  error: string;
  created_at: string;
  resolved_at: string | null;
};
export type AIState = {
  conversations: AIConversation[];
  messages: AIMessage[];
  pending_actions: AIPendingAction[];
};

export const emptyAIState: AIState = {
  conversations: [],
  messages: [],
  pending_actions: [],
};

export function normalizeAIState(
  value: Partial<AIState> | null | undefined,
): AIState {
  return {
    conversations: value?.conversations ?? [],
    messages: value?.messages ?? [],
    pending_actions: value?.pending_actions ?? [],
  };
}

export async function aiCommand(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<AIState> {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.rpc("ai_command", { action, payload });
  if (error) throw new Error(error.message);
  return normalizeAIState(data as Partial<AIState>);
}

export async function sendAIMessage(
  conversationId: string | null,
  message: string,
): Promise<AIState> {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.functions.invoke("ai-chat", {
    body: { conversation_id: conversationId, message },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return normalizeAIState(data as Partial<AIState>);
}

export type AIOperations = {
  load: () => Promise<AIState>;
  createConversation: (title: string) => Promise<AIState>;
  send: (conversationId: string | null, message: string) => Promise<AIState>;
  resolve: (action: AIPendingAction, confirm: boolean) => Promise<AIState>;
};
