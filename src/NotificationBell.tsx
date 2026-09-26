import { useEffect, useRef, useState } from "react";
import type { Notification } from "./domain";

export function NotificationBell({
  items,
  run,
}: {
  items: Notification[];
  run: (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "read">("unread");
  const root = useRef<HTMLDivElement>(null);
  const unread = items.filter((item) => !item.read_at);
  const read = items.filter((item) => item.read_at);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div className="notification-bell" ref={root}>
      <button
        type="button"
        className="bell-trigger"
        aria-label={`通知，${unread.length} 則未讀`}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path
            d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unread.length > 0 && (
          <span className="bell-count">{unread.length}</span>
        )}
      </button>
      {open && (
        <section
          id="notification-panel"
          className="notification-panel"
          aria-label="通知中心"
        >
          <div className="notification-panel-heading">
            <h2>通知</h2>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => void run("mark_all_notifications_read")}
              >
                全部標為已讀
              </button>
            )}
          </div>
          <div
            className="notification-tabs"
            role="tablist"
            aria-label="通知狀態"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "unread"}
              onClick={() => setTab("unread")}
            >
              未讀 {unread.length}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "read"}
              onClick={() => setTab("read")}
            >
              已讀 {read.length}
            </button>
          </div>
          <div
            role="tabpanel"
            aria-label={`${tab === "unread" ? "未讀" : "已讀"}通知`}
          >
            {(tab === "unread" ? unread : read).length ? (
              <ol className="notification-list">
                {(tab === "unread" ? unread : read).map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      {item.body && <p>{item.body}</p>}
                      <time>
                        {new Date(item.created_at).toLocaleString("zh-TW")}
                      </time>
                    </div>
                    {!item.read_at && (
                      <button
                        type="button"
                        aria-label={`標為已讀 ${item.title}`}
                        onClick={() =>
                          void run("mark_notification_read", { id: item.id })
                        }
                      >
                        已讀
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="subtle notification-empty">
                {tab === "unread" ? "沒有未讀通知" : "沒有已讀通知"}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
