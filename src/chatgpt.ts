export const CHATGPT_ORIGIN = "https://chatgpt.com/";
export const MAX_CHATGPT_PROMPT_LENGTH = 6000;

const HANDOFF_HEADER = [
  "這段內容由 PersonalWorkStation 帶入。",
  "請使用一般 ChatGPT 對話與 GPT-5.6 Sol High 回應。",
  "不要切換到 Work，也不要要求 OpenAI API key。",
].join("\n");

export function buildChatGPTPrompt(message: string) {
  const value = message.trim();
  if (!value) throw new Error("請輸入要交給 ChatGPT 的內容");
  if (value.length > MAX_CHATGPT_PROMPT_LENGTH)
    throw new Error(`內容最多 ${MAX_CHATGPT_PROMPT_LENGTH} 字`);
  return `${HANDOFF_HEADER}\n\n使用者要求：\n${value}`;
}

export function buildChatGPTUrl(prompt: string) {
  const url = new URL(CHATGPT_ORIGIN);
  url.searchParams.set("mode", "chat");
  url.searchParams.set("prompt", prompt);
  return url.toString();
}

export function buildSummaryPrompt(context: unknown) {
  return buildChatGPTPrompt(
    [
      "請整理下列單一 Task context。",
      "請輸出：具體標題、與上一版不同的決策、已完成、已取消、已取代、完整摘要。",
      "不要假設未提供的事實，也不要建立或修改任何工作台資料。",
      "Task context：",
      JSON.stringify(context, null, 2),
    ].join("\n"),
  );
}

export async function copyChatGPTPrompt(prompt: string) {
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(prompt);
    return true;
  } catch {
    return false;
  }
}
