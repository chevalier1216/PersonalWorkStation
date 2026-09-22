import { describe, expect, it } from "vitest";
import {
  buildChatGPTPrompt,
  buildChatGPTUrl,
  MAX_CHATGPT_PROMPT_LENGTH,
} from "../src/chatgpt";

describe("ChatGPT standard chat handoff", () => {
  it("opens chatgpt.com in chat mode with a prefilled Sol High prompt", () => {
    const prompt = buildChatGPTPrompt("整理今天的工作紀錄");
    const url = new URL(buildChatGPTUrl(prompt));

    expect(url.origin).toBe("https://chatgpt.com");
    expect(url.searchParams.get("mode")).toBe("chat");
    expect(url.searchParams.get("prompt")).toContain("GPT-5.6 Sol High");
    expect(url.searchParams.get("prompt")).toContain("不要切換到 Work");
    expect(url.searchParams.get("prompt")).toContain("整理今天的工作紀錄");
    expect(url.searchParams.has("model")).toBe(false);
    expect(url.searchParams.has("reasoning_effort")).toBe(false);
  });

  it("rejects empty and oversized prompts", () => {
    expect(() => buildChatGPTPrompt("   ")).toThrow("請輸入");
    expect(() => buildChatGPTPrompt("x".repeat(MAX_CHATGPT_PROMPT_LENGTH + 1))).toThrow(
      `最多 ${MAX_CHATGPT_PROMPT_LENGTH} 字`,
    );
  });
});
