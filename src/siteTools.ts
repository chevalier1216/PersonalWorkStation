import { taskInput, type Snapshot } from "./domain";

type ToolResult = { content: Array<{ type: "text"; text: string }> };
type SiteTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<ToolResult>;
};
export type SiteModelContext = {
  registerTool: (
    tool: SiteTool,
    options: { signal: AbortSignal },
  ) => Promise<void>;
};

const result = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
});

export function registerWorkspaceSiteTools(
  context: SiteModelContext,
  snapshot: () => Snapshot,
  run: (action: string, payload?: Record<string, unknown>) => Promise<boolean>,
) {
  const controller = new AbortController();
  const tools: SiteTool[] = [
    {
      name: "personal_workstation_list_tasks",
      description:
        "列出目前登入者的工作台 Task ID、標題、狀態、優先程度與期限。",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      async execute() {
        const data = snapshot();
        return result(
          JSON.stringify(
            data.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              status:
                data.columns.find((column) => column.id === task.column_id)
                  ?.kind ?? "unknown",
              priority: task.priority,
              due_at: task.due_at,
            })),
          ),
        );
      },
    },
    {
      name: "personal_workstation_create_task",
      description:
        "在目前登入者的工作台建立 Task；只建立 Task，不自動啟動付費 AI 執行。",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task 標題" },
          description: { type: "string", description: "Task 說明" },
          priority: { type: "string", enum: ["Regular", "High", "Urgent"] },
        },
        required: ["title"],
        additionalProperties: false,
      },
      async execute(input) {
        const parsed = taskInput.safeParse({
          title: input.title,
          description: input.description ?? "",
          priority: input.priority ?? "Regular",
          due_at: null,
          start_date: null,
          estimated_minutes: null,
          deliverable_type: null,
          deliverable_value: null,
        });
        if (!parsed.success)
          return result(`未建立：${parsed.error.issues[0].message}`);
        const before = new Set(snapshot().tasks.map((task) => task.id));
        if (!(await run("create_task", parsed.data)))
          return result(
            "未確認建立。請查看工作台錯誤訊息，重新整理後再確認。 ",
          );
        const created = snapshot().tasks.find((task) => !before.has(task.id));
        return result(
          created
            ? `已建立 Task：${created.title}（ID：${created.id}）`
            : "Task 已儲存；請重新列出 Task 取得 ID。 ",
        );
      },
    },
    {
      name: "personal_workstation_update_task",
      description:
        "依 Task ID 修改目前登入者的 Task 標題、說明或優先程度，未提供的欄位保持原值。",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "由 list_tasks 取得的 Task ID" },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["Regular", "High", "Urgent"] },
        },
        required: ["id"],
        additionalProperties: false,
      },
      async execute(input) {
        if (typeof input.id !== "string")
          return result("未修改：Task ID 無效。 ");
        const task = snapshot().tasks.find((item) => item.id === input.id);
        if (!task) return result("未修改：找不到此 Task。 ");
        const parsed = taskInput.safeParse({
          ...task,
          title: input.title ?? task.title,
          description: input.description ?? task.description,
          priority: input.priority ?? task.priority,
        });
        if (!parsed.success)
          return result(`未修改：${parsed.error.issues[0].message}`);
        return result(
          (await run("edit_task", { id: task.id, ...parsed.data }))
            ? `已更新 Task：${parsed.data.title}（ID：${task.id}）`
            : "未確認更新。請查看工作台錯誤訊息，重新整理後再確認。 ",
        );
      },
    },
  ];
  for (const tool of tools) {
    void context.registerTool(tool, { signal: controller.signal }).catch(() => {
      // Site tools are optional; normal browser and Task controls remain available.
    });
  }
  return () => controller.abort();
}
