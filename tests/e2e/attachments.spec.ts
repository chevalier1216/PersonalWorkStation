import { expect, test, type Page } from "@playwright/test";

async function openBoard(
  page: Page,
  url = "/PersonalWorkStation/tests/fixture.html",
) {
  await page.goto(url);
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await expect(page.getByLabel("下一件要做的事")).toBeEnabled({
    timeout: 30000,
  });
}

test("Task and Activity attachments persist, archive and remain searchable", async ({
  page,
}) => {
  await openBoard(page);
  const suffix = test.info().project.name;
  const title = `M6 attachments ${suffix}`;
  const taskFilename = `task-${suffix}-evidence.pdf`;
  const noteFilename = `note-${suffix}-decision.txt`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await dialog.getByLabel("新增附件", { exact: true }).setInputFiles({
    name: taskFilename,
    mimeType: "application/pdf",
    buffer: Buffer.from("M6 task evidence"),
  });
  await expect(dialog.getByText(taskFilename, { exact: true })).toBeVisible();

  const note = `M6 Activity ${suffix}`;
  await dialog.getByLabel("新增工作紀錄").fill(note);
  await dialog.getByRole("button", { name: "新增紀錄" }).click();
  const noteItem = dialog.getByText(note, { exact: true }).locator("..");
  await noteItem.getByLabel("附加檔案").setInputFiles({
    name: noteFilename,
    mimeType: "text/plain",
    buffer: Buffer.from("M6 activity evidence"),
  });
  await expect(dialog.getByText(noteFilename, { exact: true })).toBeVisible();

  const taskAttachment = dialog
    .getByText(taskFilename, { exact: true })
    .locator("xpath=ancestor::li");
  await taskAttachment.getByRole("button", { name: "封存至 Drive" }).click();
  await expect(
    taskAttachment.getByText("已封存", { exact: true }),
  ).toBeVisible();
  await expect(taskAttachment).toContainText(
    "PersonalWorkStation/Attachments/2026/09/fixture",
  );
  await taskAttachment
    .getByRole("button", { name: "取得所在資料夾連結" })
    .click();
  await expect(
    taskAttachment.getByRole("link", { name: "開啟所在資料夾" }),
  ).toHaveAttribute(
    "href",
    "https://drive.google.com/drive/folders/fixture-folder",
  );

  await page.reload();
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await expect(dialog.getByText(taskFilename, { exact: true })).toBeVisible();
  await expect(dialog.getByText(noteFilename, { exact: true })).toBeVisible();
  await dialog.getByLabel("關閉", { exact: true }).click();

  await page.getByRole("button", { name: "歷史紀錄", exact: true }).click();
  await page.getByLabel("指定欄位").selectOption("attachments");
  await page.getByLabel("搜尋內容").fill(taskFilename);
  await page.getByRole("button", { name: "搜尋", exact: true }).click();
  await expect(page.getByText("找到 1 筆結果")).toBeVisible();
  await page.getByRole("button", { name: new RegExp(taskFilename) }).click();
  await expect(
    page
      .getByRole("dialog", { name: "任務詳細資料" })
      .getByText(taskFilename, { exact: true }),
  ).toBeVisible();
});

test("rapid duplicate archive clicks keep one completed attachment", async ({
  page,
}) => {
  await openBoard(page);
  const title = `M6 double click ${test.info().project.name}`;
  const filename = `double-click-${test.info().project.name}.txt`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await dialog.getByLabel("新增附件", { exact: true }).setInputFiles({
    name: filename,
    mimeType: "text/plain",
    buffer: Buffer.from("double click evidence"),
  });
  const item = dialog
    .getByText(filename, { exact: true })
    .locator("xpath=ancestor::li");
  await item
    .getByRole("button", { name: "封存至 Drive" })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect(item.getByText("已封存", { exact: true })).toBeVisible();
  await expect(item).not.toContainText("封存失敗");
  await page.reload();
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(
    page.getByText(filename, { exact: true }).locator("xpath=ancestor::li"),
  ).toContainText("已封存");
});

test("Drive failure keeps the source and Retry archives the same attachment", async ({
  page,
}) => {
  await openBoard(
    page,
    "/PersonalWorkStation/tests/fixture.html?archiveFail=1",
  );
  const title = `M6 retry ${test.info().project.name}`;
  const filename = `retry-${test.info().project.name}.zip`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  await dialog.getByLabel("新增附件", { exact: true }).setInputFiles({
    name: filename,
    mimeType: "application/zip",
    buffer: Buffer.from("M6 retry source"),
  });
  const item = dialog
    .getByText(filename, { exact: true })
    .locator("xpath=ancestor::li");
  await item.getByRole("button", { name: "封存至 Drive" }).click();
  await expect(dialog.getByRole("alert")).toContainText("測試用 Drive 中斷");
  await expect(item.getByText("封存失敗", { exact: true })).toBeVisible();
  await expect(item.getByRole("button", { name: "開啟" })).toBeEnabled();
  await dialog.getByRole("button", { name: "重新連結 Google Drive" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "測試用 Google 授權中斷",
  );

  await openBoard(page);
  await page.getByRole("button", { name: title, exact: true }).click();
  dialog = page.getByRole("dialog", { name: "任務詳細資料" });
  const retry = dialog
    .getByText(filename, { exact: true })
    .locator("xpath=ancestor::li");
  await retry.getByRole("button", { name: "重試封存" }).click();
  await expect(retry.getByText("已封存", { exact: true })).toBeVisible();
});

test("capacity snapshots and metadata backup persist", async ({ page }) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await page.getByRole("button", { name: "設定", exact: true }).click();
  const maintenance = page.getByRole("region", { name: "儲存與維護" });
  await maintenance
    .getByRole("button", { name: "重新連結 Google Drive" })
    .click();
  await expect(maintenance.getByRole("alert")).toContainText(
    "測試用 Google 授權中斷",
  );
  await maintenance.getByRole("button", { name: "更新容量" }).click();
  await expect(maintenance.getByText("Supabase Database")).toBeVisible();
  await expect(maintenance.getByText("Supabase Storage")).toBeVisible();
  await expect(
    maintenance.getByRole("heading", { name: "Google Drive" }),
  ).toBeVisible();
  await expect(maintenance.getByRole("status")).toHaveText("容量已更新");

  await maintenance
    .getByRole("button", { name: "建立 metadata backup" })
    .click();
  await expect(maintenance.getByRole("status")).toHaveText(
    "Metadata backup 已建立",
  );
  await expect(
    maintenance.getByText(
      "PersonalWorkStation/Exports/2026/09/metadata-index.json",
    ),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "儲存與維護" })
      .getByText("PersonalWorkStation/Exports/2026/09/metadata-index.json"),
  ).toBeVisible();
});
