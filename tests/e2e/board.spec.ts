import { test, expect } from "@playwright/test";
test("failed edit retains form input and persisted task", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html?fail=edit_task");
  await expect(page.getByLabel("下一件要做的事")).toBeEnabled({
    timeout: 30000,
  });
  await page.getByLabel("下一件要做的事").fill("保留原件");
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: "保留原件", exact: true }).click();
  await page.getByLabel("標題", { exact: true }).fill("尚未保存的修改");
  await page.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "測試用連線中斷",
  );
  await expect(page.getByLabel("標題", { exact: true })).toHaveValue(
    "尚未保存的修改",
  );
  await page.getByRole("button", { name: "關閉", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "保留原件", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("button", { name: "尚未保存的修改", exact: true }),
  ).toHaveCount(0);
});
test("real PostgreSQL harness: create, move, edit, refresh, manage columns, delete", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  const quick = page.getByLabel("下一件要做的事");
  await expect(quick).toBeEnabled({ timeout: 30000 });
  await quick.fill("完成 M1 驗收");
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "完成 M1 驗收", exact: true }),
  ).toBeVisible();
  await page.getByLabel("移動 完成 M1 驗收").selectOption({ label: "進行中" });
  await expect(
    page
      .getByRole("region", { name: "進行中", exact: true })
      .getByRole("button", { name: "完成 M1 驗收", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "進行中", exact: true })
      .getByRole("button", { name: "完成 M1 驗收", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "完成 M1 驗收", exact: true }).click();
  await page.getByLabel("說明", { exact: true }).fill("瀏覽器重整後仍保留");
  await page.getByLabel("優先程度").selectOption("Urgent");
  await page.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(page.getByText("瀏覽器重整後仍保留")).toBeVisible();
  await page.getByRole("button", { name: "新增欄位", exact: true }).click();
  await page.getByLabel("欄位名稱").fill("審核");
  await page.getByLabel("任務狀態").selectOption("doing");
  await page.getByRole("button", { name: "儲存欄位" }).click();
  await page.getByRole("button", { name: "管理 審核", exact: true }).click();
  await page.getByLabel("欄位名稱").fill("待確認");
  await page.getByRole("button", { name: "儲存欄位" }).click();
  await page.getByRole("button", { name: "左移欄位 待確認" }).click();
  await expect(page.getByRole("status", { name: "儲存狀態" })).toHaveText(
    "已儲存",
  );
  await page.getByRole("button", { name: "管理 進行中", exact: true }).click();
  await page.getByLabel("替代欄位").selectOption({ label: "待確認" });
  await page.getByRole("button", { name: "刪除欄位", exact: true }).click();
  await page.getByRole("button", { name: "確認刪除欄位" }).click();
  await expect(
    page.getByRole("region", { name: "進行中", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  const replacement = page.getByRole("region", { name: "待確認", exact: true });
  await expect(
    replacement.getByRole("button", { name: "完成 M1 驗收", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByLabel("移動 完成 M1 驗收").selectOption({ label: "已完成" });
  await expect(page.getByText(/^完成 \d/)).toBeVisible();
  await page.getByRole("button", { name: "完成 M1 驗收", exact: true }).click();
  await page.getByRole("button", { name: "刪除任務" }).click();
  await page.getByRole("button", { name: "確認刪除", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "完成 M1 驗收", exact: true }),
  ).toHaveCount(0);
});
test("pointer drag or mobile movement controls", async ({ page }, info) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await expect(page.getByLabel("下一件要做的事")).toBeEnabled({
    timeout: 30000,
  });
  await page.getByLabel("下一件要做的事").fill("拖曳測試");
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  if (info.project.name === "mobile") {
    await page.getByLabel("移動 拖曳測試").selectOption({ label: "進行中" });
    await expect(
      page
        .getByRole("region", { name: "進行中", exact: true })
        .getByRole("button", { name: "拖曳測試", exact: true }),
    ).toBeVisible();
    return;
  }
  const handle = page.getByRole("button", { name: "拖曳 拖曳測試" });
  const start = await handle.boundingBox();
  const target = await page
    .getByRole("region", { name: "進行中", exact: true })
    .boundingBox();
  await page.mouse.move(
    start!.x + start!.width / 2,
    start!.y + start!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + 150, {
    steps: 15,
  });
  await page.mouse.up();
  await expect(
    page
      .getByRole("region", { name: "進行中", exact: true })
      .getByRole("button", { name: "拖曳測試", exact: true }),
  ).toBeVisible();
});
