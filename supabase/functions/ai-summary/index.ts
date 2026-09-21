import { createClient } from "npm:@supabase/supabase-js@2";
import { buildSummaryRequest, summaryOutput } from "./request.ts";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST")
    return json(405, { error: "method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAIKey = Deno.env.get("OPENAI_API_KEY");
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !publishableKey || !authorization)
    return json(401, { error: "登入資訊不完整" });
  if (!openAIKey) return json(503, { error: "AI 服務尚未設定" });

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return json(401, { error: "登入已失效" });

  let taskId = "";
  try {
    const body = (await request.json()) as { task_id?: unknown };
    taskId = typeof body.task_id === "string" ? body.task_id : "";
    if (!taskId) return json(400, { error: "缺少 task_id" });
    const contextResult = await client.rpc("summary_context", {
      target_task: taskId,
    });
    if (contextResult.error) throw contextResult.error;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${openAIKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildSummaryRequest(contextResult.data)),
    });
    const value = (await response.json()) as {
      output?: Array<Record<string, unknown>>;
      error?: { message?: string };
    };
    if (!response.ok)
      throw new Error(
        value.error?.message ?? `OpenAI Responses HTTP ${response.status}`,
      );
    const generated = summaryOutput(value.output);
    const saved = await client.rpc("summary_command", {
      action: "create",
      payload: { task_id: taskId, ...generated },
    });
    if (saved.error) throw saved.error;
    return json(200, saved.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (taskId)
      await client.rpc("summary_command", {
        action: "record_failure",
        payload: { task_id: taskId, message: message.slice(0, 2000) },
      });
    return json(502, { error: message.slice(0, 2000) });
  }
});
