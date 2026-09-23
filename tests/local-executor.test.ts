import { describe, expect, it } from "vitest";
import {
  executorPrompt,
  originAllowed,
  validateExecuteBody,
} from "../scripts/local-executor-lib.mjs";

describe("local executor guardrails", () => {
  it("only permits explicit workstation origins", () => {
    expect(originAllowed("http://127.0.0.1:5173")).toBe(true);
    expect(originAllowed("https://chevalier1216.github.io")).toBe(true);
    expect(originAllowed("https://attacker.example")).toBe(false);
  });
  it("rejects arbitrary endpoints and malformed run ids", () => {
    expect(() =>
      validateExecuteBody({
        runId: "x",
        accessToken: "a",
        supabaseUrl: "http://evil.test",
        publishableKey: "k",
      }),
    ).toThrow();
  });
  it("builds a bounded repo-aware prompt", () => {
    const prompt = executorPrompt({ run_code: "RUN-1" }, "修正登入");
    expect(prompt).toContain("RUN-1");
    expect(prompt).toContain("AGENTS.md");
    expect(prompt).toContain("修正登入");
  });
});
