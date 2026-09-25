import { supabase } from "./api";

export type Attachment = {
  id: string;
  task_id: string;
  note_id: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  source_storage_path: string;
  source_deleted_at: string | null;
  archive_status: "active" | "archiving" | "archived" | "failed";
  archive_error: string;
  drive_file_id: string | null;
  drive_web_view_link: string | null;
  drive_path: string | null;
  metadata: Record<string, unknown>;
  last_accessed_at: string;
  archived_at: string | null;
  created_at: string;
};

export type CapacitySnapshot = {
  id: string;
  service: "supabase_database" | "supabase_storage" | "google_drive";
  used_bytes: number;
  limit_bytes: number | null;
  used_percent: number | null;
  measured_at: string;
};

export type MetadataBackup = {
  id: string;
  drive_file_id: string | null;
  drive_web_view_link: string | null;
  drive_path: string | null;
  record_count: number;
  status: "completed" | "failed";
  error: string;
  created_at: string;
};

export type AttachmentState = {
  attachments: Attachment[];
  capacity: CapacitySnapshot[];
  backups: MetadataBackup[];
};

export const emptyAttachmentState: AttachmentState = {
  attachments: [],
  capacity: [],
  backups: [],
};
export const MAX_FREE_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export function normalizeAttachmentState(
  value?: Partial<AttachmentState> | null,
): AttachmentState {
  return {
    attachments: value?.attachments ?? [],
    capacity: value?.capacity ?? [],
    backups: value?.backups ?? [],
  };
}

export function backupIsDue(
  state: AttachmentState,
  now = Date.now(),
  intervalDays = 7,
) {
  const latest = state.backups.find((item) => item.status === "completed");
  return (
    !latest ||
    now - new Date(latest.created_at).getTime() >= intervalDays * 86400000
  );
}

export function capacityIsDue(
  state: AttachmentState,
  now = Date.now(),
  intervalHours = 24,
) {
  const newest = state.capacity
    .map((item) => new Date(item.measured_at).getTime())
    .sort((a, b) => b - a)[0];
  return !newest || now - newest >= intervalHours * 3600000;
}

export async function attachmentCommand(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<AttachmentState> {
  if (!supabase) throw new Error("尚未設定資料連線");
  const { data, error } = await supabase.rpc("attachment_command", {
    action,
    payload,
  });
  if (error) throw new Error(error.message);
  return normalizeAttachmentState(data as Partial<AttachmentState>);
}

function safeFilename(filename: string) {
  return (
    filename.replace(/[^A-Za-z0-9_\-.'!,*&$@=;:+?() ]/g, "_").slice(0, 180) ||
    "attachment"
  );
}

export async function uploadAttachment(
  taskId: string,
  file: File,
  noteId?: string,
) {
  if (!supabase) throw new Error("尚未設定資料連線");
  if (file.size > MAX_FREE_ATTACHMENT_BYTES)
    throw new Error("Free 方案單檔上限為 50 MB，請縮小檔案後重試");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("登入已失效");
  const path = `${auth.user.id}/${taskId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
  const uploaded = await supabase.storage
    .from("pws-attachments")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploaded.error) throw new Error(uploaded.error.message);
  try {
    return await attachmentCommand("record_upload", {
      task_id: taskId,
      note_id: noteId ?? null,
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      source_storage_path: path,
      metadata: { lastModified: file.lastModified },
    });
  } catch (error) {
    await supabase.storage.from("pws-attachments").remove([path]);
    throw error;
  }
}

export async function openAttachment(attachment: Attachment) {
  if (!supabase) throw new Error("尚未設定資料連線");
  await attachmentCommand("mark_accessed", { id: attachment.id });
  if (
    attachment.archive_status === "archived" &&
    attachment.drive_web_view_link
  )
    return attachment.drive_web_view_link;
  if (attachment.source_deleted_at)
    throw new Error("附件原件已移除，且 Drive link 不可用");
  const { data, error } = await supabase.storage
    .from("pws-attachments")
    .createSignedUrl(attachment.source_storage_path, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function archiveAttachment(id: string, googleAccessToken: string) {
  if (!supabase) throw new Error("尚未設定資料連線");
  if (!googleAccessToken) throw new Error("請重新連結 Google Drive 授權");
  const { data, error } = await supabase.functions.invoke("drive-archive", {
    body: {
      action: "archive",
      attachment_id: id,
      google_access_token: googleAccessToken,
    },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return normalizeAttachmentState(data as Partial<AttachmentState>);
}

export async function runDriveMaintenance(
  action: "measure" | "backup",
  googleAccessToken: string,
) {
  if (!supabase) throw new Error("尚未設定資料連線");
  if (!googleAccessToken) throw new Error("請重新連結 Google Drive 授權");
  const { data, error } = await supabase.functions.invoke("drive-maintenance", {
    body: { action, google_access_token: googleAccessToken },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return normalizeAttachmentState(data as Partial<AttachmentState>);
}

export type AttachmentOperations = {
  reconnect?: () => Promise<void>;
  load: () => Promise<AttachmentState>;
  upload: (
    taskId: string,
    file: File,
    noteId?: string,
  ) => Promise<AttachmentState>;
  open: (attachment: Attachment) => Promise<string>;
  archive: (id: string) => Promise<AttachmentState>;
  measure: () => Promise<AttachmentState>;
  backup: () => Promise<AttachmentState>;
};
