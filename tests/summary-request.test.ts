import { describe, expect, it } from "vitest";
import {
  SUMMARY_INSTRUCTIONS,
  SUMMARY_MODEL,
  buildSummaryRequest,
  summaryOutput,
} from "../supabase/functions/ai-summary/request";

describe("AI Summary Responses contract", () => {
  it("uses GPT-5.6 Sol xhigh and strict structured output", () => {
    const context = { task: { title: "驗證" }, notes: [] };
    const request = buildSummaryRequest(context);
    expect(request).toMatchObject({
      model: "gpt-5.6-sol",
      reasoning: { effort: "xhigh" },
      max_output_tokens: 5000,
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(SUMMARY_MODEL).toBe("gpt-5.6-sol");
    expect(SUMMARY_INSTRUCTIONS).toContain("不可信資料");
    expect(JSON.stringify(request.input)).toContain("驗證");
  });

  it("parses only a structured assistant output", () => {
    const result = summaryOutput([
      { type: "function_call" },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              title: "具體結果",
              decisions: [],
              completed: ["驗證"],
              cancelled: [],
              superseded: [],
              content: "完成。",
            }),
          },
        ],
      },
    ]);
    expect(result.title).toBe("具體結果");
  });
});
