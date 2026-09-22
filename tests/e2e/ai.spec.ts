import { test, expect } from "@playwright/test";

test("AI entry prepares a standard ChatGPT Sol High handoff", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await page.getByRole("button", { name: "AI 對話", exact: true }).click();

  const chat = page.getByRole("region", { name: "AI 對話" });
  await expect(chat.getByText("一般對話 · GPT-5.6 Sol · High")).toBeVisible();
  await chat.getByLabel("交給 ChatGPT 的內容").fill("整理今天的工作紀錄");

  const link = chat.getByRole("link", { name: "在 ChatGPT 開啟" });
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const url = new URL(href!);
  expect(url.origin).toBe("https://chatgpt.com");
  expect(url.searchParams.get("mode")).toBe("chat");
  expect(url.searchParams.get("prompt")).toContain("GPT-5.6 Sol High");
  expect(url.searchParams.get("prompt")).toContain("不要切換到 Work");
  expect(url.searchParams.get("prompt")).toContain("整理今天的工作紀錄");
  await expect(link).toHaveAttribute("target", "_blank");
});

test("ChatGPT handoff does not block the Task workspace", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  const quickChat = page.getByRole("region", { name: "AI 快問" });
  await expect(quickChat.getByText("一般對話 · GPT-5.6 Sol · High")).toBeVisible();

  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  const title = `M4 browser isolation ${test.info().project.name}`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
});
