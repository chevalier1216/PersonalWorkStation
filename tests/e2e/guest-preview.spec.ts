import { expect, test } from "@playwright/test";

test("unauthenticated visitors use isolated Guest Preview without private API traffic", async ({
  page,
}) => {
  const privateRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/(?:rest|functions|storage)\/v1\//.test(request.url()))
      privateRequests.push(request.url());
  });

  await page.goto("/PersonalWorkStation/");
  await expect(page.getByText("Guest Preview", { exact: true })).toBeVisible();
  await expect(page.getByText("展示模式", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "整理本週優先事項", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "任務看板" }).click();
  await page.getByLabel("下一件要做的事").fill("瀏覽器隔離測試");
  await page.getByRole("button", { name: "新增任務" }).click();
  await expect(
    page.getByRole("button", { name: "瀏覽器隔離測試", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "任務看板" }).click();
  await expect(
    page.getByRole("button", { name: "瀏覽器隔離測試", exact: true }),
  ).toBeVisible();
  expect(privateRequests).toEqual([]);
});
