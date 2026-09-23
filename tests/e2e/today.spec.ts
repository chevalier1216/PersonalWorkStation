import { test, expect } from "@playwright/test";

test("Today is the home page and recurring completion creates a task and notification", async ({
  page,
}, info) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await expect(
    page.getByRole("heading", { name: "今天", exact: true }),
  ).toBeVisible({
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
    page
      .getByRole("region", { name: "待辦", exact: true })
      .getByRole("button", {
        name: "M2 每日整理",
        exact: true,
      }),
  ).toBeVisible();
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.getByText("已建立下一周期任務")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "未排程", exact: true })
      .getByRole("button", {
        name: /M2 每日整理/,
      }),
  ).toBeVisible();
  await page.getByRole("button", { name: "編輯版面" }).click();
  const editor = page.getByRole("region", { name: "Today 版面設定" });
  const executionRow = editor
    .getByText("AI 執行狀態", { exact: true })
    .locator("..");
  if (info.project.name === "mobile") {
    const rows = editor.locator(".layout-module-row");
    const index = (await rows.allTextContents()).findIndex((text) =>
      text.includes("AI 執行狀態"),
    );
    for (let step = 0; step < index; step += 1)
      await executionRow
        .getByRole("button", { name: "上移模組 AI 執行狀態" })
        .click();
  } else {
    const handle = editor.getByRole("button", { name: "拖曳模組 AI 執行狀態" });
    const target = editor.getByText("任務", { exact: true }).locator("..");
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await handle.dispatchEvent("dragstart", { dataTransfer: transfer });
    await target.dispatchEvent("dragover", { dataTransfer: transfer });
    await target.dispatchEvent("drop", { dataTransfer: transfer });
  }
  await expect(editor.locator(".layout-module-row").first()).toContainText(
    "AI 執行狀態",
  );
  await page
    .getByRole("region", { name: "Today 版面設定" })
    .getByText("假日提醒", { exact: true })
    .locator("..")
    .getByRole("button", { name: "隱藏", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "假日提醒" })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "今天", exact: true }),
  ).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole("region", { name: "假日提醒" })).toHaveCount(0);
  await page.getByRole("button", { name: "編輯版面" }).click();
  await expect(
    page
      .getByRole("region", { name: "Today 版面設定" })
      .locator(".layout-module-row")
      .first(),
  ).toContainText("AI 執行狀態");
});

test("Today shows E.SUN spot and cash rates for the approved currencies", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  const rates = page.getByRole("region", { name: "玉山銀行外幣匯率" });
  await expect(rates).toBeVisible({ timeout: 30000 });
  await expect(rates.getByText("即期", { exact: true })).toBeVisible();
  await expect(rates.getByText("現金", { exact: true })).toBeVisible();
  for (const currency of ["USD", "RMB／CNY", "JPY", "EUR", "AUD"])
    await expect(
      rates.getByRole("rowheader", { name: currency }),
    ).toBeVisible();
  await expect(rates.getByRole("link", { name: "官方來源" })).toHaveAttribute(
    "href",
    /esunbank\.com/,
  );
});
