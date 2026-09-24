import { expect, test } from "@playwright/test";

test("AI Chat creates a persisted Task and observable Run", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await page.getByRole("button", { name: "AI 對話", exact: true }).click();
  const chat = page.getByRole("region", { name: "AI 對話" });
  const title = `AI workflow ${test.info().project.name}`;
  await chat.getByLabel("需求或問題").fill("建立可觀測執行紀錄");
  await chat.getByLabel("Task 標題").fill(title);
  await chat.getByRole("button", { name: "確認建立 Task" }).click();
  await expect(chat.getByRole("status")).toContainText(/RUN-\d{8}-\d{4}/);

  await page.getByRole("button", { name: "AI 執行中心", exact: true }).click();
  const center = page.getByRole("region", { name: "AI 執行中心" });
  const run = center.getByRole("button", { name: new RegExp(title) });
  await expect(run).toContainText("Waiting External");
  const runCode = await run.locator("code").innerText();
  expect(runCode).toMatch(/^RUN-\d{8}-\d{4}$/);

  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const details = page.getByRole("dialog", { name: "任務詳細資料" });
  await expect(details.getByRole("textbox", { name: "說明" })).toHaveValue(
    "建立可觀測執行紀錄",
  );
  await details.getByLabel("關閉", { exact: true }).click();
  const cardRun = page.locator(".card-run").filter({ hasText: runCode });
  await expect(cardRun).toContainText("Context");
  await expect(cardRun).toContainText(/\d+ 秒/);
  await cardRun.click();
  await expect(page.getByRole("region", { name: "AI 執行中心" })).toBeVisible();

  const reopened = center.getByRole("button", { name: new RegExp(title) });
  await reopened.click();
  await expect(
    center.getByRole("button", { name: /Trigger Success/ }),
  ).toBeVisible();
  await expect(
    center.getByRole("button", { name: /Context Queued/ }),
  ).toBeVisible();
  await expect(
    center.getByRole("button", { name: /Execution Queued/ }),
  ).toBeVisible();
  await expect(
    center.getByRole("button", { name: /Verification Queued/ }),
  ).toBeVisible();
  await expect(
    center.getByRole("button", { name: /Output Queued/ }),
  ).toBeVisible();
  await center.getByRole("button", { name: /Trigger Success/ }).click();
  await expect(center.getByText("建立可觀測執行紀錄")).toBeVisible();
  await expect(
    center.getByRole("button", { name: "交給本機 Codex" }),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "AI 執行中心", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "AI 執行中心" })
      .getByRole("button", { name: new RegExp(title) }),
  ).toBeVisible({ timeout: 30000 });
});
