import { createClient } from "npm:@supabase/supabase-js@2";
import {
  DRIVE_API,
  DRIVE_UPLOAD_API,
  backupFilename,
  driveFileMetadata,
  driveFolderQuery,
  hasForbiddenBackupKey,
  maintenanceDirectory,
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
  const value = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok)
    throw new Error(
      value.error?.message ?? `Google Drive HTTP ${response.status}`,
    );
  return value;
}

async function ensureFolder(token: string, name: string, parentId?: string) {
  const query = new URLSearchParams({
    q: driveFolderQuery(name, parentId),
    fields: "files(id,name)",
    pageSize: "10",
  });
  const listed = await googleJson<{ files?: Array<{ id: string }> }>(
    token,
    `${DRIVE_API}/files?${query}`,
  );
  if (listed.files?.[0]?.id) return listed.files[0].id;
  const created = await googleJson<{ id: string }>(
    token,
    `${DRIVE_API}/files`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        ...(parentId ? { parents: [parentId] } : {}),
        appProperties: { product: "PersonalWorkStation" },
      }),
    },
  );
  return created.id;
}

async function uploadBackup(
  token: string,
  filename: string,
  parentId: string,
  data: string,
) {
  const boundary = `pws-${crypto.randomUUID()}`;
  const metadata = driveFileMetadata(filename, parentId, "metadata-backup");
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
    data,
    `\r\n--${boundary}--`,
  ]);
  const response = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,webViewLink`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const value = (await response.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!response.ok || !value.id)
    throw new Error(
      value.error?.message ?? `Google Drive upload HTTP ${response.status}`,
    );
  return value.id;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST")
    return json(405, { error: "method not allowed" });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !publishableKey || !authorization)
    return json(401, { error: "登入資訊不完整" });
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return json(401, { error: "登入已失效" });

  let action = "";
  try {
    const body = (await request.json()) as {
      action?: unknown;
      google_access_token?: unknown;
    };
    action = typeof body.action === "string" ? body.action : "";
    const googleToken =
      typeof body.google_access_token === "string"
        ? body.google_access_token
        : "";
    if (!googleToken) return json(400, { error: "缺少 Google Drive 授權" });
    const metrics = await client.rpc("maintenance_metrics");
    if (metrics.error) throw metrics.error;

    if (action === "measure") {
      const quota = await googleJson<{
        storageQuota?: { limit?: string; usage?: string };
      }>(googleToken, `${DRIVE_API}/about?fields=storageQuota`);
      const measurements = [
        {
          service: "supabase_database",
          used: Number(metrics.data.database_bytes),
          limit: 500 * 1024 * 1024,
        },
        {
          service: "supabase_storage",
          used: Number(metrics.data.attachment_bytes),
          limit: 1024 * 1024 * 1024,
        },
        {
          service: "google_drive",
          used: Number(quota.storageQuota?.usage ?? 0),
          limit: quota.storageQuota?.limit
            ? Number(quota.storageQuota.limit)
            : null,
        },
      ];
      let state: unknown = null;
      for (const item of measurements) {
        const recorded = await client.rpc("attachment_command", {
          action: "record_capacity",
          payload: {
            service: item.service,
            used_bytes: item.used,
            limit_bytes: item.limit,
            used_percent: item.limit ? (item.used / item.limit) * 100 : null,
          },
        });
        if (recorded.error) throw recorded.error;
        state = recorded.data;
      }
      return json(200, state);
    }

    if (action === "backup") {
      const exported = await client.rpc("maintenance_export");
      if (exported.error) throw exported.error;
      const serialized = JSON.stringify(exported.data, null, 2);
      if (hasForbiddenBackupKey(exported.data))
        throw new Error("Backup 內容含有禁止的 Secret 欄位");
      const path = maintenanceDirectory();
      let parent: string | undefined;
      for (const folder of path)
        parent = await ensureFolder(googleToken, folder, parent);
      const filename = backupFilename();
      const fileId = await uploadBackup(
        googleToken,
        filename,
        parent!,
        serialized,
      );
      const verified = await googleJson<{
        id: string;
        name: string;
        size?: string;
        webViewLink?: string;
        trashed?: boolean;
      }>(
        googleToken,
        `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,size,webViewLink,trashed`,
      );
      if (
        verified.trashed ||
        verified.name !== filename ||
        Number(verified.size) !== new Blob([serialized]).size
      )
        throw new Error("Drive backup 讀回驗證不一致");
      const recorded = await client.rpc("attachment_command", {
        action: "record_backup",
        payload: {
          status: "completed",
          drive_file_id: fileId,
          drive_web_view_link:
            verified.webViewLink ??
            `https://drive.google.com/open?id=${encodeURIComponent(fileId)}`,
          drive_path: path.join("/") + "/" + filename,
          record_count: Number(metrics.data.record_count),
        },
      });
      if (recorded.error) throw recorded.error;
      return json(200, recorded.data);
    }
    return json(400, { error: "不支援的維護操作" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (action === "backup")
      await client.rpc("attachment_command", {
        action: "record_backup",
        payload: {
          status: "failed",
          error: message.slice(0, 2000),
          record_count: 0,
        },
      });
    return json(502, { error: message.slice(0, 2000) });
  }
});
