import { test, expect } from "@playwright/test";

test("Today is the home page and recurring completion creates a task and notification", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await expect(page.getByRole("heading", { name: "今天", exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  const quick = page.getByLabel("下一件要做的事");
  await expect(quick).toBeEnabled();
  await quick.fill("M2 每日整理");
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: "M2 每日整理", exact: true }).click();
  const details = page.getByRole("dialog", { name: "任務詳細資料" });
  await details.getByLabel("循環任務").selectOption("daily");
  await details.getByLabel("循環間隔").fill("1");
  await details.getByRole("button", { name: "儲存基本資料" }).click();
  await details.getByLabel("關閉", { exact: true }).click();
  await page.getByLabel("移動 M2 每日整理").selectOption({ label: "已完成" });
  await expect(
    page.getByRole("region", { name: "待辦", exact: true }).getByRole("button", {
      name: "M2 每日整理",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.getByText("已建立下一周期任務")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "未排程", exact: true }).getByRole("button", {
      name: /M2 每日整理/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "編輯版面" }).click();
  await page.getByRole("button", { name: "隱藏", exact: true }).last().click();
  await expect(page.getByRole("region", { name: "假日提醒" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "今天", exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole("region", { name: "假日提醒" })).toHaveCount(0);
});
