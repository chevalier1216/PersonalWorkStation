import { expect, test } from "@playwright/test";

test("V1 main navigation exposes every authoritative destination", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  const navigation = page.getByRole("navigation", { name: "主要導覽" });
  for (const name of [
    "今日",
    "任務看板",
    "行事曆",
    "AI 對話",
    "AI 摘要",
    "歷史紀錄",
    "設定",
  ]) {
    await expect(
      navigation.getByRole("button", { name, exact: true }),
    ).toBeVisible();
  }

  await navigation.getByRole("button", { name: "行事曆" }).click();
  await expect(page.getByRole("region", { name: "行事曆" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "行事曆" })).toBeVisible();

  await navigation.getByRole("button", { name: "AI 摘要" }).click();
  await expect(page.getByRole("region", { name: "AI 摘要" })).toBeVisible();

  await navigation.getByRole("button", { name: "歷史紀錄" }).click();
  await expect(page.getByRole("region", { name: "歷史搜尋" })).toBeVisible();

  await navigation.getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("region", { name: "儲存與維護" })).toBeVisible();
});

test("AI Summary index opens its source Task at the selected version", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await expect(page.getByLabel("下一件要做的事")).toBeEnabled({
    timeout: 30000,
  });
  const title = `M7 summary index ${test.info().project.name}`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await dialog.getByLabel("Summary 標題").fill("發佈準備與驗證結果");
  await dialog.getByLabel("完整摘要").fill("已完成響應式摘要索引驗證。");
  await dialog.getByRole("button", { name: "保存 Summary Card" }).click();
  await expect(dialog.getByText("發佈準備與驗證結果")).toBeVisible();
  await dialog.getByLabel("關閉", { exact: true }).click();

  await page.getByRole("button", { name: "AI 摘要", exact: true }).click();
  const summary = page.getByRole("region", { name: "AI 摘要" });
  await summary.getByRole("button", { name: new RegExp(title) }).click();
  dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await expect(dialog.locator(".summary-card.search-hit")).toBeVisible();
});
