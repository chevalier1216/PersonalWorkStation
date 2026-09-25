import { createClient } from "npm:@supabase/supabase-js@2";
import {
  DRIVE_API,
  DRIVE_UPLOAD_API,
  archiveDirectory,
  driveFileMetadata,
  driveFolderQuery,
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

async function uploadDriveFile(
  token: string,
  file: Blob,
  mimeType: string,
  filename: string,
  parentId: string,
  attachmentId: string,
) {
  const boundary = `pws-${crypto.randomUUID()}`;
  const metadata = driveFileMetadata(filename, parentId, attachmentId);
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);
  const response = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,webViewLink,parents`,
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

  let attachmentId = "";
  let archiveStarted = false;
  try {
    const body = (await request.json()) as {
      action?: unknown;
      attachment_id?: unknown;
      google_access_token?: unknown;
    };
    if (body.action !== "archive" && body.action !== "folder")
      return json(400, { error: "不支援的操作" });
    attachmentId =
      typeof body.attachment_id === "string" ? body.attachment_id : "";
    const googleToken =
      typeof body.google_access_token === "string"
        ? body.google_access_token
        : "";
    if (!attachmentId || !googleToken)
      return json(400, { error: "缺少附件或 Google Drive 授權" });

    const loaded = await client.rpc("attachment_command", {
      action: "load",
      payload: {},
    });
    if (loaded.error) throw loaded.error;
    const attachment = loaded.data?.attachments?.find(
      (item: Record<string, unknown>) => item.id === attachmentId,
    );
    if (!attachment) throw new Error("找不到附件");
    if (body.action === "folder") {
      if (!attachment.drive_file_id) throw new Error("附件尚未封存至 Drive");
      const driveFile = await googleJson<{
        parents?: string[];
        trashed?: boolean;
      }>(
        googleToken,
        `${DRIVE_API}/files/${encodeURIComponent(String(attachment.drive_file_id))}?fields=parents,trashed`,
      );
      if (driveFile.trashed || !driveFile.parents?.[0])
        throw new Error("找不到附件所在的 Drive 資料夾");
      return json(200, {
        folder_url: `https://drive.google.com/drive/folders/${encodeURIComponent(driveFile.parents[0])}`,
      });
    }
    if (
      attachment.archive_status === "archived" ||
      attachment.archive_status === "archiving"
    )
      return json(200, loaded.data);
    if (
      attachment.drive_file_id &&
      attachment.drive_web_view_link &&
      attachment.drive_path
    ) {
      const driveFile = await googleJson<{
        name?: string;
        size?: string;
        trashed?: boolean;
      }>(
        googleToken,
        `${DRIVE_API}/files/${encodeURIComponent(String(attachment.drive_file_id))}?fields=name,size,trashed`,
      );
      if (
        driveFile.trashed ||
        driveFile.name !== attachment.filename ||
        Number(driveFile.size) !== Number(attachment.size_bytes)
      )
        throw new Error("Drive 附件驗證不一致，已保留目前紀錄");
      const repaired = await client.rpc("attachment_command", {
        action: "archive_success",
        payload: {
          id: attachmentId,
          drive_file_id: attachment.drive_file_id,
          drive_web_view_link: attachment.drive_web_view_link,
          drive_path: attachment.drive_path,
        },
      });
      if (repaired.error) throw repaired.error;
      if (!attachment.source_deleted_at) {
        const removed = await client.storage
          .from("pws-attachments")
          .remove([String(attachment.source_storage_path)]);
        if (!removed.error) {
          const deleted = await client.rpc("attachment_command", {
            action: "archive_source_deleted",
            payload: { id: attachmentId },
          });
          if (!deleted.error) return json(200, deleted.data);
        }
      }
      return json(200, repaired.data);
    }
    if (attachment.source_deleted_at) throw new Error("附件原件已移除");
    const claimed = await client.rpc("attachment_archive_claim", {
      target: attachmentId,
    });
    if (claimed.error) throw claimed.error;
    if (!claimed.data) {
      const latest = await client.rpc("attachment_command", {
        action: "load",
        payload: {},
      });
      if (latest.error) throw latest.error;
      return json(200, latest.data);
    }
    archiveStarted = true;

    const downloaded = await client.storage
      .from("pws-attachments")
      .download(String(attachment.source_storage_path));
    if (downloaded.error || !downloaded.data)
      throw new Error(downloaded.error?.message ?? "無法讀取附件原件");

    const path = archiveDirectory();
    let parent: string | undefined;
    for (const folder of path)
      parent = await ensureFolder(googleToken, folder, parent);
    const driveFileId = await uploadDriveFile(
      googleToken,
      downloaded.data,
      String(attachment.mime_type),
      String(attachment.filename),
      parent!,
      attachmentId,
    );
    const verified = await googleJson<{
      id: string;
      name: string;
      size?: string;
      webViewLink?: string;
      trashed?: boolean;
    }>(
      googleToken,
      `${DRIVE_API}/files/${encodeURIComponent(driveFileId)}?fields=id,name,size,webViewLink,trashed`,
    );
    if (
      verified.trashed ||
      verified.name !== attachment.filename ||
      Number(verified.size ?? attachment.size_bytes) !==
        Number(attachment.size_bytes)
    )
      throw new Error("Drive 讀回驗證不一致，已保留原件");
    const webViewLink =
      verified.webViewLink ??
      `https://drive.google.com/open?id=${encodeURIComponent(driveFileId)}`;
    const archived = await client.rpc("attachment_command", {
      action: "archive_success",
      payload: {
        id: attachmentId,
        drive_file_id: driveFileId,
        drive_web_view_link: webViewLink,
        drive_path: path.join("/") + "/" + attachment.filename,
      },
    });
    if (archived.error) throw archived.error;
    const visible = archived.data?.attachments?.find(
      (item: Record<string, unknown>) => item.id === attachmentId,
    );
    if (!visible?.drive_web_view_link)
      throw new Error("工作台無法找回 Drive 附件");

    const removed = await client.storage
      .from("pws-attachments")
      .remove([String(attachment.source_storage_path)]);
    if (!removed.error) {
      const deleted = await client.rpc("attachment_command", {
        action: "archive_source_deleted",
        payload: { id: attachmentId },
      });
      if (!deleted.error) return json(200, deleted.data);
    }
    return json(200, archived.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (attachmentId && archiveStarted) {
      const latest = await client.rpc("attachment_command", {
        action: "load",
        payload: {},
      });
      const current = latest.data?.attachments?.find(
        (item: Record<string, unknown>) => item.id === attachmentId,
      );
      if (
        !latest.error &&
        current?.archive_status === "archiving" &&
        !current.drive_file_id
      )
        await client.rpc("attachment_command", {
          action: "archive_failure",
          payload: { id: attachmentId, message: message.slice(0, 2000) },
        });
    }
    return json(502, { error: message.slice(0, 2000) });
  }
});
