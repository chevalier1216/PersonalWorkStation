import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  emptyAIState,
  type AIOperations,
  type AIPendingAction,
  type AIState,
} from "./ai";

const fieldLabels: Record<string, string> = {
  title: "標題",
  description: "說明",
  priority: "優先程度",
  due_at: "截止時間",
  start_date: "開始日期",
  estimated_minutes: "預估分鐘",
  deliverable_type: "交付物類型",
  deliverable_value: "交付物",
  recurrence_type: "循環方式",
  recurrence_interval: "循環間隔",
  recurrence_unit: "循環單位",
};

function ActionDetails({ action }: { action: AIPendingAction }) {
  if (action.action_type === "edit_task") {
    const changes = action.payload.changes;
    if (changes && typeof changes === "object" && !Array.isArray(changes)) {
      return (
        <ul className="action-details">
          {Object.entries(changes).map(([field, value]) => (
            <li key={field}>
              <strong>{fieldLabels[field] ?? field}</strong>
              <span>
                {value == null || value === "" ? "清除" : String(value)}
              </span>
            </li>
          ))}
        </ul>
      );
    }
  }
  if (action.action_type === "calendar_relation")
    return (
      <p className="action-detail">
        Calendar：{String(action.payload.calendar_id ?? "未指定")}
      </p>
    );
  return <p className="action-detail">確認後將刪除此 Task 與其關聯資料。</p>;
}

export function AIChat({
  operations,
  compact = false,
  onWorkspaceChanged,
  resolveAction,
}: {
  operations?: AIOperations;
  compact?: boolean;
  onWorkspaceChanged: () => Promise<void>;
  resolveAction?: (
    action: AIPendingAction,
    confirm: boolean,
  ) => Promise<AIState>;
}) {
  const [state, setState] = useState<AIState>(emptyAIState);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(operations));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!operations) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    operations
      .load()
      .then((next) => {
        if (cancelled) return;
        setState(next);
        setConversationId(
          (current) => current ?? next.conversations[0]?.id ?? null,
        );
      })
      .catch((reason) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [operations]);

  const active =
    state.conversations.find((item) => item.id === conversationId) ?? null;
  const messages = useMemo(
    () =>
      state.messages.filter((item) => item.conversation_id === conversationId),
    [state.messages, conversationId],
  );
  const pending = state.pending_actions.filter(
    (item) =>
      item.conversation_id === conversationId && item.status === "pending",
  );

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!operations || !message.trim() || busy || loading) return;
    setBusy(true);
    setError("");
    try {
      const next = await operations.send(conversationId, message.trim());
      setState(next);
      setConversationId(
        (current) => current ?? next.conversations[0]?.id ?? null,
      );
      setMessage("");
      await onWorkspaceChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function resolve(action: AIPendingAction, confirm: boolean) {
    if (!operations || busy) return;
    setBusy(true);
    setError("");
    try {
      setState(await (resolveAction ?? operations.resolve)(action, confirm));
      if (confirm) await onWorkspaceChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={compact ? "ai-chat compact" : "ai-chat full"}
      aria-label={compact ? "AI 快問" : "AI 對話"}
    >
      <div className="module-heading">
        <div>
          <p className="eyebrow">AI CHAT</p>
          <h2>{compact ? "快問與建立 Task" : (active?.title ?? "AI 對話")}</h2>
        </div>
        {!compact && operations && (
          <button
            disabled={busy || loading}
            onClick={async () => {
              const next = await operations.createConversation("新對話");
              setState(next);
              setConversationId(next.conversations[0]?.id ?? null);
            }}
          >
            新對話
          </button>
        )}
      </div>
      {!operations ? (
        <p className="subtle">AI server-side integration 尚未設定。</p>
      ) : (
        <div className={compact ? "" : "ai-layout"}>
          {!compact && (
            <nav
              className="conversation-list"
              aria-label="Conversation history"
            >
              {state.conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  aria-current={
                    conversation.id === conversationId ? "page" : undefined
                  }
                  onClick={() => setConversationId(conversation.id)}
                >
                  <strong>{conversation.title}</strong>
                  <time>
                    {new Date(conversation.updated_at).toLocaleString("zh-TW")}
                  </time>
                </button>
              ))}
            </nav>
          )}
          <div className="chat-panel">
            {!compact && (
              <ol className="message-list">
                {messages.map((item) => (
                  <li key={item.id} className={item.role}>
                    <span>{item.role === "user" ? "你" : "AI"}</span>
                    <p>{item.content}</p>
                  </li>
                ))}
                {!messages.length && <li className="subtle">開始一段新對話</li>}
              </ol>
            )}
            {pending.map((action) => (
              <article className="pending-action" key={action.id}>
                <p className="eyebrow">需要確認</p>
                <strong>{action.label}</strong>
                <ActionDetails action={action} />
                <div className="dialog-actions">
                  <button
                    disabled={busy}
                    onClick={() => void resolve(action, false)}
                  >
                    取消
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void resolve(action, true)}
                  >
                    確認執行
                  </button>
                </div>
              </article>
            ))}
            {(error || active?.last_error) && (
              <p className="error" role="alert">
                {error || active?.last_error}
              </p>
            )}
            <form className="chat-compose" onSubmit={send}>
              <label>
                {compact ? "詢問 AI" : "訊息"}
                <textarea
                  value={message}
                  disabled={loading}
                  maxLength={20000}
                  placeholder="例如：建立一個明天下午 3 點整理週報的 High Task"
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>
              <button
                className="primary"
                disabled={busy || loading || !message.trim()}
              >
                {busy || loading ? "處理中…" : "送出"}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
