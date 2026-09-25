import { test, expect } from "@playwright/test";

test("AI entry pauses chat handoff while keeping Task and Run intake", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await page.getByRole("button", { name: "AI 對話", exact: true }).click();

  const chat = page.getByRole("region", { name: "AI 對話" });
  await expect(chat.getByText("工作臺內建立 Task 與可追蹤 Run")).toBeVisible();
  await expect(
    chat.getByRole("heading", { name: "建立 Task 與 Run" }),
  ).toBeVisible();
  await chat.getByLabel("需求或問題").fill("整理今天的工作紀錄");

  await expect(
    chat.getByText("ChatGPT 對話操作尚未接通，入口暫停。", { exact: false }),
  ).toBeVisible();
  await expect(chat.getByRole("link", { name: "在 ChatGPT 開啟" })).toHaveCount(
    0,
  );
});

test("compatible web chat does not block the Task workspace", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  const quickChat = page.getByRole("region", { name: "AI 快問" });
  await expect(
    quickChat.getByText("工作臺內建立 Task 與可追蹤 Run"),
  ).toBeVisible();

  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  const title = `M4 browser isolation ${test.info().project.name}`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
});
