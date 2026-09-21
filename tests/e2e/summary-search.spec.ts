import { expect, test } from "@playwright/test";

async function openBoard(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await expect(page.getByLabel("下一件要做的事")).toBeEnabled({
    timeout: 30000,
  });
}

test("history search locates a Note and Summary versions persist", async ({
  page,
}) => {
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

  await page.getByRole("button", { name: "歷史搜尋", exact: true }).click();
  await page.getByLabel("指定欄位").selectOption("notes");
  await page.getByLabel("搜尋內容").fill(note);
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page.getByText("找到 1 筆結果")).toBeVisible();
  await page.getByRole("button", { name: new RegExp(note) }).click();
  dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await expect(dialog.locator(".search-hit")).toContainText(note);

  await dialog.getByRole("button", { name: "@AI 整理" }).click();
  await expect(dialog.getByText("發佈準備與驗證結果")).toBeVisible();
  await dialog.getByRole("button", { name: "@AI 整理" }).click();
  await expect(
    dialog.getByText("發佈準備與風險變更", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /最新版本：v\./ }),
  ).toBeVisible();
  await expect(dialog.locator(".summary-card")).toHaveCount(2);

  await page.reload();
  await openBoard(page);
  await page.getByRole("button", { name: title, exact: true }).click();
  dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await expect(dialog.locator(".summary-card")).toHaveCount(2);
  await expect(
    dialog.getByText("來源 Task：" + title, { exact: false }),
  ).toBeVisible();
});

test("chat history search opens the matching conversation", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  const phrase = `M5-chat-${test.info().project.name}-needle`;
  await page.getByRole("button", { name: "AI 對話", exact: true }).click();
  const chat = page.getByRole("region", { name: "AI 對話" });
  await chat.getByLabel("訊息").fill(phrase);
  await chat.getByRole("button", { name: "送出", exact: true }).click();
  await expect(chat.getByText(phrase, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "歷史搜尋", exact: true }).click();
  await page.getByLabel("指定欄位").selectOption("chat");
  await page.getByLabel("搜尋內容").fill(phrase);
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await page
    .getByRole("button", { name: new RegExp(phrase) })
    .first()
    .click();
  await expect(
    page
      .getByRole("region", { name: "AI 對話" })
      .locator(".message-list")
      .getByText(phrase, { exact: true }),
  ).toBeVisible();
});

test("AI Summary failure preserves the Task", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html?summaryFail=1");
  await openBoard(page);
  const title = `M5 failure ${test.info().project.name}`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await dialog.getByRole("button", { name: "@AI 整理" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "測試用 AI Summary 中斷",
  );
  await dialog.getByLabel("關閉", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
});
