import { test, expect } from "@playwright/test";

async function sendAI(page: import("@playwright/test").Page, message: string) {
  const chat = page.getByRole("region", { name: "AI 對話" });
  await chat.getByLabel("訊息").fill(message);
  await chat.getByRole("button", { name: "送出", exact: true }).click();
  return chat;
}

test("AI creates a Task directly and confirms edits while preserving history", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  const original = `M4 AI direct ${test.info().project.name}`;
  const updated = `${original} updated`;

  await page.getByRole("button", { name: "AI 對話", exact: true }).click();
  let chat = await sendAI(page, `建立 Task：${original}`);
  await expect(chat.getByText(`已建立 Task「${original}」。`)).toBeVisible();

  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await expect(
    page.getByRole("button", { name: original, exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "AI 對話", exact: true }).click();
  chat = await sendAI(page, `修改 Task：${original} => ${updated}`);
  const pending = chat
    .getByText(`修改「${original}」`)
    .locator("..", { hasText: updated });
  await expect(pending).toBeVisible();
  await pending.getByRole("button", { name: "確認執行" }).click();

  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await expect(
    page.getByRole("button", { name: updated, exact: true }),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "AI 對話", exact: true }).click();
  chat = page.getByRole("region", { name: "AI 對話" });
  const history = chat.getByRole("list");
  await expect(
    history.getByText(`建立 Task：${original}`, { exact: true }),
  ).toBeVisible();
  await expect(
    history.getByText(`修改 Task：${original} => ${updated}`, { exact: true }),
  ).toBeVisible();

  chat = await sendAI(page, `刪除 Task：${updated}`);
  const deletion = chat.getByText(`刪除「${updated}」`).locator("..");
  await deletion.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await expect(
    page.getByRole("button", { name: updated, exact: true }),
  ).toBeVisible();
});

test("AI confirms a Calendar relation and persists it", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  const title = `M4 Calendar AI ${test.info().project.name}`;
  const calendar = page.getByRole("region", { name: "Google Calendar" });
  await calendar.getByRole("button", { name: "同步", exact: true }).click();
  await expect(calendar.getByText("M3 行事曆事件")).toBeVisible();
  await page.getByRole("button", { name: "AI 對話", exact: true }).click();
  const first = await sendAI(page, `建立 Task：${title}`);
  await expect(first.getByText(`已建立 Task「${title}」。`)).toBeVisible();
  const chat = await sendAI(page, `加入 Calendar：${title}`);
  const pending = chat
    .getByText(`為「${title}」建立 Calendar event`)
    .locator("..");
  await pending.getByRole("button", { name: "確認執行" }).click();
  await expect(pending).toBeHidden();

  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  const task = page.getByRole("button", { name: title, exact: true });
  await expect(task).toBeVisible();
  await task.click();
  await expect(
    page
      .getByRole("dialog", { name: "任務詳細資料" })
      .getByText(/已關聯「個人行事曆」/),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "任務詳細資料" })
      .getByText(/已關聯「個人行事曆」/),
  ).toBeVisible();
});

test("AI failure leaves the Task workspace usable", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html?aiFail=1");
  await page.getByRole("button", { name: "AI 對話", exact: true }).click();
  const chat = await sendAI(page, "整理今天的重點");
  await expect(chat.getByRole("alert")).toContainText("測試用 OpenAI 中斷");

  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  const title = `M4 failure isolation ${test.info().project.name}`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
});
