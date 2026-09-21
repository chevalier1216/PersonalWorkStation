export const DRIVE_API = "https://www.googleapis.com/drive/v3";
export const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export function archiveDirectory(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((item) => item.type === "year")!.value;
  const month = parts.find((item) => item.type === "month")!.value;
  return ["PersonalWorkStation", "Attachments", year, month];
}

export function maintenanceDirectory(date = new Date()) {
  const [, , year, month] = archiveDirectory(date);
  return ["PersonalWorkStation", "Exports", year, month];
}

export function backupFilename(date = new Date()) {
  const value = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/[\s:]/g, "-");
  return `metadata-index-${value}.json`;
}

export function driveFolderQuery(name: string, parentId?: string) {
  const escaped = name.replace(/'/g, "\\'");
  return [
    `name='${escaped}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    parentId ? `'${parentId}' in parents` : undefined,
  ]
    .filter(Boolean)
    .join(" and ");
}

export function driveFileMetadata(
  filename: string,
  parentId: string,
  attachmentId: string,
) {
  return {
    name: filename,
    parents: [parentId],
    appProperties: {
      product: "PersonalWorkStation",
      attachmentId,
    },
  };
}

export function hasForbiddenBackupKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenBackupKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) =>
      /access[_-]?token|refresh[_-]?token|service[_-]?role|openai[_-]?key|client[_-]?secret/i.test(
        key,
      ) || hasForbiddenBackupKey(item),
  );
}
