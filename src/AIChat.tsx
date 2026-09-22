import { useMemo, useState } from "react";
import {
  buildChatGPTPrompt,
  buildChatGPTUrl,
  copyChatGPTPrompt,
  MAX_CHATGPT_PROMPT_LENGTH,
} from "./chatgpt";

export function AIChat({
  compact = false,
}: {
  compact?: boolean;
  [key: string]: unknown;
}) {
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const handoff = useMemo(() => {
    if (!message.trim()) return null;
    try {
      const prompt = buildChatGPTPrompt(message);
      return { prompt, url: buildChatGPTUrl(prompt) };
    } catch (reason) {
      return { error: reason instanceof Error ? reason.message : String(reason) };
    }
  }, [message]);

  async function prepare() {
    if (!handoff || "error" in handoff) return;
    setError("");
    const success = await copyChatGPTPrompt(handoff.prompt);
    setCopied(success);
    if (!success)
      setError("瀏覽器未允許複製；ChatGPT 開啟後請從工作台手動複製內容。");
  }

  return (
    <section
      className={compact ? "ai-chat compact" : "ai-chat full"}
      aria-label={compact ? "AI 快問" : "AI 對話"}
    >
      <div className="module-heading">
        <div>
          <p className="eyebrow">CHATGPT</p>
          <h2>{compact ? "用一般對話快問" : "在 ChatGPT 繼續"}</h2>
          <p className="subtle">一般對話 · GPT-5.6 Sol · High</p>
        </div>
      </div>
      <div className="chat-panel">
        <p>
          工作台會開啟 ChatGPT 網頁並嘗試預填內容；同時複製提示，預填失敗時可直接貼上。
        </p>
        <p className="subtle">
          開啟後請確認上方選的是「對話」，推理強度顯示「高」，再自行送出。不要切換至 Work。
        </p>
        <label>
          {compact ? "想問什麼" : "交給 ChatGPT 的內容"}
          <textarea
            value={message}
            maxLength={MAX_CHATGPT_PROMPT_LENGTH}
            placeholder="例如：請根據這段工作紀錄整理下一步"
            onChange={(event) => {
              setMessage(event.target.value);
              setCopied(false);
              setError("");
            }}
          />
        </label>
        {handoff && "error" in handoff && (
          <p className="error" role="alert">{handoff.error}</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {copied && (
          <p className="success" role="status">
            提示已複製。若 ChatGPT 沒有自動帶入，請貼上後送出。
          </p>
        )}
        {handoff && !("error" in handoff) ? (
          <a
            className="primary chatgpt-link"
            href={handoff.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void prepare()}
          >
            在 ChatGPT 開啟
          </a>
        ) : (
          <button className="primary" disabled>
            在 ChatGPT 開啟
          </button>
        )}
      </div>
    </section>
  );
}
