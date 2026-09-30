import { createClient } from "npm:@supabase/supabase-js@2";
import {
  GOOGLE_CALENDAR_API,
  googleErrorMessage,
  normalizeGoogleEvent,
  normalizeStandaloneEvent,
  requestKey,
  standaloneEventBody,
  taskEventBody,
  type GoogleCalendar,
  type GoogleEvent,
} from "./request.ts";

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

class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reconnectRequired = false,
  ) {
    super(message);
  }
}

function encodeBase64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}

function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function encryptionKey(secret: string) {
  let bytes: Uint8Array;
  try {
    const decoded = decodeBase64(secret);
    bytes = decoded.length === 32 ? decoded : new TextEncoder().encode(secret);
  } catch {
    bytes = new TextEncoder().encode(secret);
  }
  if (bytes.length !== 32)
    bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptToken(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await encryptionKey(secret),
      new TextEncoder().encode(value),
    ),
  );
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv);
  packed.set(encrypted, iv.length);
  return encodeBase64(packed);
}

async function decryptToken(value: string, secret: string) {
  const packed = decodeBase64(value);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: packed.slice(0, 12) },
    await encryptionKey(secret),
    packed.slice(12),
  );
  return new TextDecoder().decode(decrypted);
}

async function googleJson<T>(
  token: string,
  url: string,
  init: RequestInit = {},
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new GoogleApiError(
      response.status,
      googleErrorMessage(response.status, body),
    );
  return body as T;
}

function calendarRecord(calendar: GoogleCalendar, selected = true) {
  return {
    id: calendar.id,
    summary: calendar.summary ?? "未命名 Calendar",
    color: calendar.backgroundColor ?? "#7895b2",
    time_zone: calendar.timeZone ?? "",
    is_primary: Boolean(calendar.primary),
    selected,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST")
    return json(405, { error: "method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const tokenSecret = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY");
  const googleClientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !authorization)
    return json(401, { error: "登入資訊不完整" });
  if (!tokenSecret)
    return json(503, { error: "Calendar 憑證加密尚未完成設定" });

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json(401, { error: "登入已失效" });

  const status = await userClient.rpc("calendar_oauth_status");
  if (status.error) return json(403, { error: status.error.message });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "請求格式無效" });
  }
  const action = typeof body.action === "string" ? body.action : "";
  if (action === "status") return json(200, status.data);

  if (action === "store_credentials") {
    const accessToken =
      typeof body.google_access_token === "string"
        ? body.google_access_token.trim()
        : "";
    const refreshToken =
      typeof body.google_refresh_token === "string"
        ? body.google_refresh_token.trim()
        : "";
    if (!accessToken && !refreshToken)
      return json(400, { error: "沒有可保存的 Google OAuth 憑證" });
    const stored = await serviceClient.rpc("calendar_oauth_store", {
      target: auth.user.id,
      access_cipher: accessToken
        ? await encryptToken(accessToken, tokenSecret)
        : "",
      access_expires_at: accessToken
        ? new Date(Date.now() + 50 * 60000).toISOString()
        : null,
      refresh_cipher: refreshToken
        ? await encryptToken(refreshToken, tokenSecret)
        : null,
    });
    if (stored.error) return json(502, { error: stored.error.message });
    const next = await userClient.rpc("calendar_oauth_status");
    if (next.error) return json(502, { error: next.error.message });
    return json(200, next.data);
  }

  async function readCredential() {
    const read = await serviceClient.rpc("calendar_oauth_read", {
      target: auth.user!.id,
    });
    if (read.error) throw new Error(read.error.message);
    if (!read.data || read.data.needs_reconnect)
      throw new GoogleApiError(
        401,
        "Google Calendar 授權已失效，請重新連結一次",
        true,
      );
    return read.data as {
      access_token_cipher: string | null;
      access_token_expires_at: string | null;
      refresh_token_cipher: string | null;
    };
  }

  async function refreshAccessToken(
    suppliedCredential?: Awaited<ReturnType<typeof readCredential>>,
  ) {
    const credential = suppliedCredential ?? (await readCredential());
    if (
      !credential.refresh_token_cipher ||
      !googleClientId ||
      !googleClientSecret
    )
      throw new GoogleApiError(
        503,
        "Google Calendar 無法靜默續期，請重新連結或完成 OAuth secret 設定",
      );
    const refreshToken = await decryptToken(
      credential.refresh_token_cipher,
      tokenSecret,
    );
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const value = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !value.access_token) {
      const invalidGrant = value.error === "invalid_grant";
      const message = invalidGrant
        ? "Google Refresh Token 已失效，請重新連結一次"
        : value.error_description || value.error || "Google Token 續期失敗";
      await serviceClient.rpc("calendar_oauth_mark_error", {
        target: auth.user!.id,
        message,
        reconnect: invalidGrant,
      });
      throw new GoogleApiError(invalidGrant ? 401 : 502, message, invalidGrant);
    }
    await serviceClient.rpc("calendar_oauth_store", {
      target: auth.user!.id,
      access_cipher: await encryptToken(value.access_token, tokenSecret),
      access_expires_at: new Date(
        Date.now() + Math.max(60, (value.expires_in ?? 3600) - 60) * 1000,
      ).toISOString(),
      refresh_cipher: value.refresh_token
        ? await encryptToken(value.refresh_token, tokenSecret)
        : null,
    });
    return value.access_token;
  }

  async function accessToken(forceRefresh = false) {
    const credential = await readCredential();
    if (
      !forceRefresh &&
      credential.access_token_cipher &&
      credential.access_token_expires_at &&
      Date.parse(credential.access_token_expires_at) > Date.now() + 60000
    )
      return decryptToken(credential.access_token_cipher, tokenSecret);
    return refreshAccessToken(credential);
  }

  async function withGoogle<T>(operation: (token: string) => Promise<T>) {
    try {
      return await operation(await accessToken());
    } catch (error) {
      if (error instanceof GoogleApiError && error.status === 401) {
        try {
          return await operation(await accessToken(true));
        } catch (retryError) {
          if (retryError instanceof GoogleApiError && retryError.status === 401)
            throw new GoogleApiError(
              401,
              "Google Calendar 權限已失效，請重新連結一次",
              true,
            );
          throw retryError;
        }
      }
      throw error;
    }
  }

  async function workspace(
    action: string,
    payload: Record<string, unknown> = {},
  ) {
    const response = await userClient.rpc("workspace_command", {
      action,
      payload,
    });
    if (response.error) throw new Error(response.error.message);
    return response.data;
  }

  async function cacheEvent(calendar: GoogleCalendar, event: GoogleEvent) {
    const cached = await serviceClient.rpc("calendar_cache_event", {
      target: auth.user!.id,
      payload: {
        calendar: calendarRecord(calendar),
        event: normalizeGoogleEvent(calendar.id, event),
      },
    });
    if (cached.error) throw new Error(cached.error.message);
  }

  try {
    if (action === "sync") {
      try {
        const current = await workspace("load");
        const prior = new Map(
          (current.google_calendars ?? []).map(
            (item: Record<string, unknown>) => [
              item.calendar_id,
              Boolean(item.selected),
            ],
          ),
        );
        const synced = await withGoogle(async (token) => {
          const listed = await googleJson<{ items?: GoogleCalendar[] }>(
            token,
            `${GOOGLE_CALENDAR_API}/users/me/calendarList?maxResults=250`,
          );
          const hasPrior = prior.size > 0;
          const calendars = (listed.items ?? []).map((calendar) =>
            calendarRecord(
              calendar,
              prior.get(calendar.id) ??
                (!hasPrior && Boolean(calendar.primary)),
            ),
          );
          const start = new Date();
          start.setUTCHours(0, 0, 0, 0);
          const end = new Date(
            Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 1),
          );
          const events: ReturnType<typeof normalizeGoogleEvent>[] = [];
          for (const calendar of calendars.filter((item) => item.selected)) {
            let pageToken = "";
            let pages = 0;
            do {
              if (++pages > 40)
                throw new Error(
                  "Google Calendar 行程過多，單次同步超過 40 頁上限",
                );
              const query = new URLSearchParams({
                singleEvents: "true",
                orderBy: "startTime",
                timeMin: start.toISOString(),
                timeMax: end.toISOString(),
                maxResults: "250",
              });
              if (pageToken) query.set("pageToken", pageToken);
              const page = await googleJson<{
                items?: GoogleEvent[];
                nextPageToken?: string;
              }>(
                token,
                `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendar.id)}/events?${query}`,
              );
              events.push(
                ...(page.items ?? [])
                  .filter((event) => event.status !== "cancelled")
                  .map((event) => normalizeGoogleEvent(calendar.id, event)),
              );
              pageToken = page.nextPageToken ?? "";
            } while (pageToken);
          }
          return { calendars, events };
        });
        return json(200, {
          snapshot: await workspace("calendar_sync_success", synced),
        });
      } catch (error) {
        if (error instanceof GoogleApiError && error.status === 401)
          throw error;
        const message = error instanceof Error ? error.message : String(error);
        return json(200, {
          snapshot: await workspace("calendar_sync_failure", { message }),
        });
      }
    }

    if (action === "create_task_event") {
      const calendarId =
        typeof body.calendar_id === "string" ? body.calendar_id : "";
      const suppliedTask =
        body.task && typeof body.task === "object"
          ? (body.task as Record<string, unknown>)
          : {};
      const loaded = await workspace("load");
      const task = (loaded.tasks ?? []).find(
        (item: Record<string, unknown>) => item.id === suppliedTask.id,
      );
      if (!task || !calendarId)
        return json(400, { error: "找不到 Task 或 Calendar" });
      try {
        const created = await withGoogle(async (token) => {
          const query = new URLSearchParams({
            privateExtendedProperty: `personalWorkStationTaskId=${task.id}`,
            maxResults: "1",
            singleEvents: "true",
          });
          const existing = await googleJson<{ items?: GoogleEvent[] }>(
            token,
            `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
          );
          const priorEvent = existing.items?.[0];
          const event =
            priorEvent ??
            (await googleJson<GoogleEvent>(
              token,
              `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
              { method: "POST", body: JSON.stringify(taskEventBody(task)) },
            ));
          const calendar = await googleJson<GoogleCalendar>(
            token,
            `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
          );
          return { event, calendar: { ...calendar, id: calendarId } };
        });
        await cacheEvent(created.calendar, created.event);
        return json(200, {
          snapshot: await workspace("calendar_link_success", {
            task_id: task.id,
            calendar_id: created.calendar.id,
            event_id: created.event.id,
            html_link: created.event.htmlLink ?? "",
          }),
        });
      } catch (error) {
        if (error instanceof GoogleApiError && error.status === 401)
          throw error;
        const message = error instanceof Error ? error.message : String(error);
        return json(200, {
          snapshot: await workspace("calendar_link_failure", {
            task_id: task.id,
            calendar_id: calendarId,
            message,
          }),
        });
      }
    }

    if (action === "create_event") {
      const input = normalizeStandaloneEvent(body);
      const key = await requestKey(auth.user.id, input);
      const claim = await serviceClient.rpc("calendar_site_tool_claim", {
        target: auth.user.id,
        key,
        request_input: input,
      });
      if (claim.error) throw new Error(claim.error.message);
      if (claim.data?.state === "pending")
        return json(409, {
          error: "相同 Calendar 工具呼叫仍在執行，請稍後查詢",
        });
      if (claim.data?.state === "succeeded")
        return json(200, {
          ...claim.data.result,
          deduplicated: true,
          snapshot: await workspace("load"),
        });
      try {
        const created = await withGoogle(async (token) => {
          const calendar = await googleJson<GoogleCalendar>(
            token,
            `${GOOGLE_CALENDAR_API}/calendars/primary`,
          );
          const query = new URLSearchParams({
            privateExtendedProperty: `personalWorkStationRequestKey=${key}`,
            maxResults: "1",
            singleEvents: "true",
          });
          const existing = await googleJson<{ items?: GoogleEvent[] }>(
            token,
            `${GOOGLE_CALENDAR_API}/calendars/primary/events?${query}`,
          );
          const priorEvent = existing.items?.[0];
          const event =
            priorEvent ??
            (await googleJson<GoogleEvent>(
              token,
              `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
              {
                method: "POST",
                body: JSON.stringify(standaloneEventBody(input, key)),
              },
            ));
          return {
            calendar: { ...calendar, primary: true },
            event,
            deduplicated: Boolean(priorEvent),
          };
        });
        await cacheEvent(created.calendar, created.event);
        const result = {
          status: "succeeded",
          event_id: created.event.id,
          title: created.event.summary?.trim() || input.title,
          start_at: created.event.start?.dateTime ?? input.start_at,
          end_at: created.event.end?.dateTime ?? input.end_at,
          timezone: input.timezone,
          html_link: created.event.htmlLink ?? "",
        };
        const completed = await serviceClient.rpc(
          "calendar_site_tool_complete",
          {
            target: auth.user.id,
            key,
            request_result: result,
          },
        );
        if (completed.error) throw new Error(completed.error.message);
        return json(200, {
          ...result,
          deduplicated: created.deduplicated,
          snapshot: await workspace("load"),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await serviceClient.rpc("calendar_site_tool_fail", {
          target: auth.user.id,
          key,
          message,
        });
        throw error;
      }
    }

    return json(400, { error: "不支援的 Calendar 操作" });
  } catch (error) {
    if (
      error instanceof GoogleApiError &&
      error.status === 401 &&
      error.reconnectRequired
    ) {
      await serviceClient.rpc("calendar_oauth_mark_error", {
        target: auth.user.id,
        message: error.message,
        reconnect: true,
      });
      return json(401, {
        error: error.message,
        code: "google_reconnect_required",
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    return json(502, { error: message.slice(0, 2000) });
  }
});
