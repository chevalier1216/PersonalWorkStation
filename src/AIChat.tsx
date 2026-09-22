import { useMemo, useState } from "react";
import {
  buildChatGPTPrompt,
  buildChatGPTUrl,
  MAX_CHATGPT_PROMPT_LENGTH,
} from "./chatgpt";
import type { Priority } from "./domain";

export type AITaskDraft = {
  title: string;
  description: string;
  priority: Priority;
};

export function AIChat({
  compact = false,
  createTask,
  taskCreationDisabled = false,
}: {
  compact?: boolean;
  createTask?: (draft: AITaskDraft) => Promise<string | false>;
  taskCreationDisabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPriority, setDraftPriority] = useState<Priority>("Regular");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState("");
  const handoff = useMemo(() => {
    if (!message.trim()) return null;
    try {
      const prompt = buildChatGPTPrompt(message);
      return { prompt, url: buildChatGPTUrl(prompt) };
    } catch (reason) {
      return {
        error: reason instanceof Error ? reason.message : String(reason),
      };
    }
  }, [message]);

  return (
    <section
      className={compact ? "ai-chat compact" : "ai-chat full"}
      aria-label={compact ? "AI 快問" : "AI 對話"}
    >
      <div className="module-heading">
        <div>
          <p className="eyebrow">AI CHAT</p>
          <h2>{compact ? "AI 快問與執行入口" : "AI 對話"}</h2>
          <p className="subtle">工作臺內建立 Task 與可追蹤 Run</p>
        </div>
      </div>
      <div className="chat-panel">
        <p>
          輸入需求後可先以相容的 ChatGPT 網頁入口討論，或直接在下方建立 Task 與
          Run。
        </p>
        <p className="subtle">
          網頁入口只用於相容問答，不代表 Run 已執行。尚未連接 executor 時，Run
          會如實顯示 Waiting External。
        </p>
        <label>
          {compact ? "想問什麼" : "需求或問題"}
          <textarea
            value={message}
            maxLength={MAX_CHATGPT_PROMPT_LENGTH}
            placeholder="例如：請根據這段工作紀錄整理下一步"
            onChange={(event) => {
              setMessage(event.target.value);
              setError("");
            }}
          />
        </label>
        {handoff && "error" in handoff && (
          <p className="error" role="alert">
            {handoff.error}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {handoff && !("error" in handoff) ? (
          <a
            className="primary chatgpt-link"
            href={handoff.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            在 ChatGPT 開啟
          </a>
        ) : (
          <button className="primary" disabled>
            在 ChatGPT 開啟
          </button>
        )}
        {createTask && (
          <form
            className="ai-task-import"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!draftTitle.trim() || savingDraft) return;
              setSavingDraft(true);
              setDraftSaved("");
              setError("");
              try {
                const saved = await createTask({
                  title: draftTitle.trim(),
                  description: draftDescription.trim(),
                  priority: draftPriority,
                });
                if (saved) {
                  setDraftTitle("");
                  setDraftDescription("");
                  setDraftPriority("Regular");
                  setDraftSaved(saved);
                }
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : String(reason),
                );
              } finally {
                setSavingDraft(false);
              }
            }}
          >
            <h3>建立 Task 與 Run</h3>
            <p className="subtle">
              確認需求後才建立 Task 與關聯 Run；可從 AI 執行中心查看狀態。
            </p>
            <label>
              Task 標題
              <input
                value={draftTitle}
                maxLength={300}
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  setDraftSaved("");
                }}
              />
            </label>
            <label>
              Task 說明（選填）
              <textarea
                value={draftDescription}
                maxLength={20000}
                onChange={(event) => setDraftDescription(event.target.value)}
              />
            </label>
            <label>
              優先程度
              <select
                value={draftPriority}
                onChange={(event) =>
                  setDraftPriority(event.target.value as Priority)
                }
              >
                <option value="Regular">一般</option>
                <option value="High">重要</option>
                <option value="Urgent">緊急</option>
              </select>
            </label>
            <button
              className="primary"
              disabled={
                taskCreationDisabled || savingDraft || !draftTitle.trim()
              }
            >
              {savingDraft ? "建立中…" : "確認建立 Task"}
            </button>
            {draftSaved && (
              <p className="success" role="status">
                {draftSaved}，可到任務看板或 AI 執行中心查看。
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
