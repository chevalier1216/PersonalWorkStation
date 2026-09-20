import { createClient } from "npm:@supabase/supabase-js@2";
import { parseChinaNotice, parseTaiwanCsv } from "./parser.ts";

const sources = {
  cn: "https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html",
  tw: "https://www.dgpa.gov.tw/FileConversion?filename=dgpa%2Ffiles%2F202506%2Fa52331bd-a189-466b-b0f0-cae3062bbf74.csv&name=115%E5%B9%B4%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B%E6%94%BF%E5%BA%9C%E8%A1%8C%E6%94%BF%E6%A9%9F%E9%97%9C%E8%BE%A6%E5%85%AC%E6%97%A5%E6%9B%86%E8%A1%A8.csv&nfix=",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

Deno.serve(async (request) => {
  const expected = Deno.env.get("HOLIDAY_SYNC_SECRET");
  if (!expected || request.headers.get("x-holiday-sync-secret") !== expected) return json(401, { error: "unauthorized" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json(500, { error: "missing Supabase runtime configuration" });
  const client = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  try {
    const [chinaResponse, taiwanResponse] = await Promise.all([fetch(sources.cn), fetch(sources.tw)]);
    if (!chinaResponse.ok) throw new Error(`中國官方來源 HTTP ${chinaResponse.status}`);
    if (!taiwanResponse.ok) throw new Error(`台灣官方來源 HTTP ${taiwanResponse.status}`);
    const [chinaHtml, taiwanCsv] = await Promise.all([chinaResponse.text(), taiwanResponse.text()]);
    const days = [...parseChinaNotice(chinaHtml, sources.cn, 2026), ...parseTaiwanCsv(taiwanCsv, sources.tw, 2026)];
    const { data, error } = await client.rpc("replace_calendar_days", { target_year: 2026, new_days: days });
    if (error) throw error;
    return json(200, { ok: true, count: days.length, result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client.rpc("record_calendar_sync_failure", { failure_message: message });
    return json(502, { ok: false, error: message });
  }
});
