import { expect, test } from "@playwright/test";

async function openBoard(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await expect(page.getByLabel("下一件要做的事")).toBeEnabled({ timeout: 30000 });
}

async function saveSummary(
  dialog: import("@playwright/test").Locator,
  title: string,
  content: string,
) {
  await dialog.getByLabel("Summary 標題").fill(title);
  await dialog.getByLabel("已完成（每行一項）").fill("驗證 Task persistence");
  await dialog.getByLabel("與上一版不同的決策（每行一項）").fill("分階段發布");
  await dialog.getByLabel("完整摘要").fill(content);
  await dialog.getByRole("button", { name: "保存 Summary Card" }).click();
}

test("history search locates a Note and manual Summary versions persist", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await openBoard(page);
  const suffix = test.info().project.name;
  const title = `M5 summary ${suffix}`;
  const note = `M5-note-${suffix}-production-refresh`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await dialog.getByLabel("新增工作紀錄").fill(note);
  await dialog.getByRole("button", { name: "新增紀錄" }).click();
  await dialog.getByLabel("關閉", { exact: true }).click();

  await page.getByRole("button", { name: "歷史紀錄", exact: true }).click();
  await page.getByLabel("指定欄位").selectOption("notes");
  await page.getByLabel("搜尋內容").fill(note);
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page.getByText("找到 1 筆結果")).toBeVisible();
  await page.getByRole("button", { name: new RegExp(note) }).click();
  dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await expect(dialog.locator(".search-hit")).toContainText(note);

  const handoff = dialog.getByRole("link", { name: "在 ChatGPT 整理" });
  const url = new URL((await handoff.getAttribute("href"))!);
  expect(url.origin).toBe("https://chatgpt.com");
  expect(url.searchParams.get("prompt")).toContain(title);
  expect(url.searchParams.get("prompt")).toContain(note);

  await saveSummary(dialog, "發佈準備與驗證結果", "完成持久化驗證。");
  await expect(dialog.getByText("發佈準備與驗證結果", { exact: true })).toBeVisible();
  await saveSummary(dialog, "發佈準備與風險變更", "接下來分階段發布。");
  await expect(dialog.getByText("發佈準備與風險變更", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /最新版本：v\./ })).toBeVisible();
  await expect(dialog.locator(".summary-card")).toHaveCount(2);

  await page.reload();
  await openBoard(page);
  await page.getByRole("button", { name: title, exact: true }).click();
  dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await expect(dialog.locator(".summary-card")).toHaveCount(2);
});

test("workspace history excludes copied ChatGPT conversations", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await page.getByRole("button", { name: "歷史紀錄", exact: true }).click();
  await expect(page.getByLabel("指定欄位").getByRole("option", { name: "AI 對話" })).toHaveCount(0);
  await expect(page.getByText("ChatGPT 對話請在 ChatGPT 內搜尋")).toBeVisible();
});

test("an incomplete Summary draft cannot change the Task", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await openBoard(page);
  const title = `M5 safe draft ${test.info().project.name}`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await dialog.getByLabel("Summary 標題").fill("只有標題");
  await expect(dialog.getByRole("button", { name: "保存 Summary Card" })).toBeDisabled();
  await dialog.getByLabel("關閉", { exact: true }).click();
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
});
