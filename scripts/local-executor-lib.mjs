export const defaultPort = 4317;

export function originAllowed(origin, configured = "") {
  if (!origin) return false;
  const allowed = new Set([
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "https://chevalier1216.github.io",
    ...configured
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ]);
  return allowed.has(origin);
}

export function validateExecuteBody(value) {
  if (!value || typeof value !== "object") throw new Error("無效的執行請求");
  for (const key of ["runId", "accessToken", "supabaseUrl", "publishableKey"])
    if (typeof value[key] !== "string" || !value[key].trim())
      throw new Error(`缺少 ${key}`);
  const url = new URL(value.supabaseUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co"))
    throw new Error("只接受 HTTPS Supabase project URL");
  if (!/^[0-9a-f-]{36}$/i.test(value.runId)) throw new Error("Run ID 格式錯誤");
  return value;
}

export function executorPrompt(run, request) {
  return `你正在執行 PersonalWorkStation Run ${run.run_code}。\n任務：${request}\n\n遵守 repository root AGENTS.md 與 docs/product/08-EXECUTION-RULES.md。只處理這個 Run 的範圍；先檢查現況，完成實作、必要驗證、commit、push 目前工作分支。不得修改已定案但與任務無關的內容。若遇到產品決策、OAuth、權限、破壞性操作或互斥選擇，停止執行，在 human_gate 填入原因與問題，verification.passed 必須為 false；否則 human_gate 為 null。只有實際驗證通過才能回報 passed=true。輸出必須符合指定 JSON schema。`;
}
