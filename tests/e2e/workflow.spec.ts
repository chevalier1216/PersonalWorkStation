import { expect, test } from "@playwright/test";

test("AI Chat creates a persisted Task and observable Run", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await page.getByRole("button", { name: "AI 對話", exact: true }).click();
  const chat = page.getByRole("region", { name: "AI 對話" });
  const title = `AI workflow ${test.info().project.name}`;
  await chat.getByLabel("Task 標題").fill(title);
  await chat.getByLabel("Task 說明（選填）").fill("建立可觀測執行紀錄");
  await chat.getByRole("button", { name: "確認建立 Task" }).click();
  await expect(chat.getByRole("status")).toContainText(/RUN-\d{8}-\d{4}/);

  await page.getByRole("button", { name: "AI 執行中心", exact: true }).click();
  const center = page.getByRole("region", { name: "AI 執行中心" });
  const run = center.getByRole("button", { name: new RegExp(title) });
  await expect(run).toContainText("Waiting External");
  await run.click();
  await expect(center.getByRole("button", { name: /Trigger Success/ })).toBeVisible();
  await expect(center.getByRole("button", { name: /Context Queued/ })).toBeVisible();
  await expect(center.getByRole("button", { name: /Execution Queued/ })).toBeVisible();
  await expect(center.getByRole("button", { name: /Verification Queued/ })).toBeVisible();
  await expect(center.getByRole("button", { name: /Output Queued/ })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "AI 執行中心", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "AI 執行中心" })
      .getByRole("button", { name: new RegExp(title) }),
  ).toBeVisible({ timeout: 30000 });
});
