import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseEsunRates } from "./parser.ts";

const source =
  "https://www.esunbank.com/zh-tw/personal/deposit/rate/forex/foreign-exchange-rates";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(url, serviceKey);
  const attempted = new Date().toISOString();
  try {
    const response = await fetch(source, {
      headers: { "user-agent": "PersonalWorkStation/1.0" },
    });
    if (!response.ok) throw new Error(`玉山網站 HTTP ${response.status}`);
    const parsed = parseEsunRates(await response.text());
    const rows = parsed.rates.map((rate) => ({
      ...rate,
      quoted_at: parsed.quoted_at,
      fetched_at: attempted,
      source_url: source,
    }));
    const { error } = await client.from("exchange_rates").upsert(rows);
    if (error) throw error;
    await client
      .from("exchange_rate_sync")
      .upsert({
        singleton: true,
        last_attempt_at: attempted,
        last_success_at: attempted,
        last_error: "",
      });
    return Response.json({ ok: true, count: rows.length }, { headers: cors });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    await client
      .from("exchange_rate_sync")
      .upsert({
        singleton: true,
        last_attempt_at: attempted,
        last_error: message,
      });
    return Response.json(
      { ok: false, error: message },
      { status: 502, headers: cors },
    );
  }
});
