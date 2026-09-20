import { createClient } from "@supabase/supabase-js";
import type { Snapshot } from "./domain";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;
export function normalizeSnapshot(snapshot: Partial<Snapshot>): Snapshot {
  return {
    columns: snapshot.columns ?? [],
    tasks: snapshot.tasks ?? [],
    tags: snapshot.tags ?? [],
    checklist: snapshot.checklist ?? [],
    notes: snapshot.notes ?? [],
    relations: snapshot.relations ?? [],
    history: snapshot.history ?? [],
    notifications: snapshot.notifications ?? [],
    preferences: snapshot.preferences ?? {
      module_order: ["tasks", "notifications", "holidays"],
      hidden_modules: [],
      updated_at: "",
    },
    calendar_days: snapshot.calendar_days ?? [],
  };
}
export async function command(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<Snapshot> {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.rpc("workspace_command", {
    action,
    payload,
  });
  if (error) throw new Error(error.message);
  return normalizeSnapshot(data as Partial<Snapshot>);
}
