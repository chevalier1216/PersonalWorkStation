import { test, expect } from "@playwright/test";

test("AI entry pauses chat handoff while keeping Task and Run intake", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await page.getByRole("button", { name: "AI 對話", exact: true }).click();

  const chat = page.getByRole("region", { name: "AI 對話" });
  await expect(chat.getByText("工作臺內建立 Task 與可追蹤 Run")).toBeVisible();
  await expect(
    chat.getByRole("heading", { name: "建立 Task 與 Run" }),
  ).toBeVisible();
  await chat.getByLabel("需求或問題").fill("整理今天的工作紀錄");

  await expect(
    chat.getByText("網頁內 ChatGPT 對話入口暫停。", { exact: false }),
  ).toBeVisible();
  await expect(chat.getByRole("link", { name: "在 ChatGPT 開啟" })).toHaveCount(
    0,
  );
});

test("Today hides AI Chat without blocking the Task workspace", async ({
  page,
}) => {
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await expect(page.getByRole("region", { name: "AI 快問" })).toHaveCount(0);

  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  const title = `M4 browser isolation ${test.info().project.name}`;
  await page.getByLabel("下一件要做的事").fill(title);
  await page.getByRole("button", { name: "新增任務", exact: true }).click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
});

test("desktop site tools use the signed-in Task commands and persist changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    type Tool = {
      name: string;
      execute: (
        input: Record<string, unknown>,
      ) => Promise<{ content: Array<{ text: string }> }>;
    };
    const tools = new Map<string, Tool>();
    (window as Window & { __siteTools?: Map<string, Tool> }).__siteTools =
      tools;
    Object.defineProperty(document, "modelContext", {
      value: {
        registerTool: async (
          tool: Tool,
          { signal }: { signal: AbortSignal },
        ) => {
          if (signal.aborted) return;
          tools.set(tool.name, tool);
          signal.addEventListener("abort", () => {
            if (tools.get(tool.name) === tool) tools.delete(tool.name);
          });
        },
      },
    });
  });
  await page.goto("/PersonalWorkStation/tests/fixture.html");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __siteTools?: Map<string, unknown> })
            .__siteTools?.size ?? 0,
      ),
    )
    .toBe(3);
  const title = `Site tool ${test.info().project.name}`;
  const created = await page.evaluate(async (taskTitle) => {
    const tools = (
      window as unknown as Window & {
        __siteTools: Map<
          string,
          {
            execute: (
              input: Record<string, unknown>,
            ) => Promise<{ content: Array<{ text: string }> }>;
          }
        >;
      }
    ).__siteTools;
    return tools
      .get("personal_workstation_create_task")!
      .execute({ title: taskTitle });
  }, title);
  expect(created.content[0].text).toContain("已建立 Task");
  const listed = await page.evaluate(async () => {
    const tools = (
      window as unknown as Window & {
        __siteTools: Map<
          string,
          {
            execute: (
              input: Record<string, unknown>,
            ) => Promise<{ content: Array<{ text: string }> }>;
          }
        >;
      }
    ).__siteTools;
    return tools.get("personal_workstation_list_tasks")!.execute({});
  });
  const task = (
    JSON.parse(listed.content[0].text) as Array<{ id: string; title: string }>
  ).find((item) => item.title === title);
  expect(task?.id).toBeTruthy();
  const updated = await page.evaluate(
    async ({ id, nextTitle }) => {
      const tools = (
        window as unknown as Window & {
          __siteTools: Map<
            string,
            {
              execute: (
                input: Record<string, unknown>,
              ) => Promise<{ content: Array<{ text: string }> }>;
            }
          >;
        }
      ).__siteTools;
      return tools
        .get("personal_workstation_update_task")!
        .execute({ id, title: nextTitle });
    },
    { id: task!.id, nextTitle: `${title} updated` },
  );
  expect(updated.content[0].text).toContain("已更新 Task");
  await page.reload();
  await page.getByRole("button", { name: "任務看板", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `${title} updated`, exact: true }),
  ).toBeVisible();
});
