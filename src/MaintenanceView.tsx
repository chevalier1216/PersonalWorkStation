import { useEffect, useState } from "react";
import {
  emptyAttachmentState,
  type AttachmentOperations,
  type AttachmentState,
} from "./attachments";

const serviceLabels = {
  supabase_database: "Supabase Database",
  supabase_storage: "Supabase Storage",
  google_drive: "Google Drive",
};

function bytes(value: number | null) {
  if (value == null) return "未知";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

export function MaintenanceView({
  operations,
}: {
  operations?: AttachmentOperations;
}) {
  const [state, setState] = useState<AttachmentState>(emptyAttachmentState);
  const [busy, setBusy] = useState(Boolean(operations));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!operations) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    operations
      .load()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [operations]);

  async function execute(action: "measure" | "backup") {
    if (!operations) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setState(await operations[action]());
      setNotice(action === "measure" ? "容量已更新" : "Metadata backup 已建立");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="maintenance-view" aria-label="儲存與維護">
      <div className="heading">
        <div>
          <p className="eyebrow">STORAGE & MAINTENANCE</p>
          <h1>儲存與維護</h1>
          <p className="muted">容量接近 70% 時提醒；不會靜默刪除資料。</p>
        </div>
        <div className="toolbar">
          {operations?.reconnect && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void operations.reconnect!().catch((reason) =>
                  setError(
                    reason instanceof Error ? reason.message : String(reason),
                  ),
                )
              }
            >
              重新連結 Google Drive
            </button>
          )}
          <button
            disabled={busy || !operations}
            onClick={() => void execute("measure")}
          >
            更新容量
          </button>
          <button
            className="primary"
            disabled={busy || !operations}
            onClick={() => void execute("backup")}
          >
            建立 metadata backup
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="status" role="status">
        {busy ? "處理中…" : notice}
      </p>
      <div className="capacity-grid">
        {state.capacity.map((item) => (
          <article
            className={
              item.used_percent != null && item.used_percent >= 70
                ? "capacity-card warning"
                : "capacity-card"
            }
            key={item.service}
          >
            <h2>{serviceLabels[item.service]}</h2>
            <strong>
              {item.used_percent == null
                ? "比例未知"
                : `${item.used_percent.toFixed(1)}%`}
            </strong>
            <p>
              {bytes(item.used_bytes)} / {bytes(item.limit_bytes)}
            </p>
            <time>{new Date(item.measured_at).toLocaleString("zh-TW")}</time>
          </article>
        ))}
        {!busy && !state.capacity.length && (
          <p className="subtle">尚無容量快照</p>
        )}
      </div>
      <section className="backup-history">
        <h2>Metadata / Index Backup</h2>
        <ol>
          {state.backups.map((backup) => (
            <li key={backup.id}>
              <strong>{backup.status === "completed" ? "完成" : "失敗"}</strong>
              <span>
                {backup.record_count} 筆 · {backup.drive_path ?? backup.error}
              </span>
              {backup.drive_web_view_link && (
                <a
                  href={backup.drive_web_view_link}
                  target="_blank"
                  rel="noreferrer"
                >
                  開啟 Drive backup
                </a>
              )}
              <time>{new Date(backup.created_at).toLocaleString("zh-TW")}</time>
            </li>
          ))}
          {!busy && !state.backups.length && (
            <li className="subtle">尚無 backup 紀錄</li>
          )}
        </ol>
      </section>
    </section>
  );
}
