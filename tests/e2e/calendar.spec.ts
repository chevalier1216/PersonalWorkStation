import { test, expect } from "@playwright/test";

test("Calendar sync, selection and Task event relation survive refresh", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  const calendar = page.getByRole("region", { name: "Google Calendar" });
  await expect(calendar).toBeVisible({ timeout: 30000 });
  await calendar.getByRole("button", { name: "同步", exact: true }).click();
  await expect(calendar.getByText("M3 行事曆事件")).toBeVisible();
  await calendar.getByRole("button", { name: "選擇 Calendar" }).click();
  await expect(calendar.getByLabel("個人行事曆（主要）")).toBeChecked();
  await calendar.getByLabel("工作", { exact: true }).click();
  await expect(calendar.getByLabel("工作", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  const title = `M3 Calendar relation ${test.info().project.name}`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const details = page.getByRole("dialog", { name: "任務詳細資料" });
  await details.getByLabel("開始日期（選填）").fill("2026-09-23");
  await details.getByRole("button", { name: "儲存基本資料" }).click();
  await details.getByLabel("Task Calendar").selectOption("work@test");
  await details.getByRole("button", { name: "建立 Calendar event" }).click();
  await expect(details.getByText(/已關聯「工作」/)).toBeVisible();
  await details.getByLabel("關閉", { exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "任務詳細資料" }).getByText(/已關聯「工作」/),
  ).toBeVisible();
});

test("Calendar API failure keeps the Task, notifies and offers Retry", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html?calendarFail=1");
  const calendar = page.getByRole("region", { name: "Google Calendar" });
  await calendar.getByRole("button", { name: "同步", exact: true }).click();
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  const title = `M3 Calendar failure ${test.info().project.name}`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const details = page.getByRole("dialog", { name: "任務詳細資料" });
  await details.getByLabel("開始日期（選填）").fill("2026-09-24");
  await details.getByRole("button", { name: "儲存基本資料" }).click();
  await details.getByRole("button", { name: "建立 Calendar event" }).click();
  await expect(details.getByText(/同步失敗：測試用 Google API 中斷/)).toBeVisible();
  await expect(details.getByRole("button", { name: "重試建立事件" })).toBeVisible();
  await details.getByLabel("關閉", { exact: true }).click();
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.getByText("Task 行事曆同步失敗")).toBeVisible();
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
});
