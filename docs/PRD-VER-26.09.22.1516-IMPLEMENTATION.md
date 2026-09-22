# PRD ver.26.09.22.1516 — Conflict Check 與實作狀態

日期：2026-09-22

## 權威來源

產品規格入口為 `docs/product/00_PRD_INDEX.md`。`01` 至 `07` 是目前 authoritative spec；`08-EXECUTION-RULES.md` 只管理 repository 執行規則，不改寫產品決策。

## Conflict check

新版 PRD 已取代下列舊決策，因此不視為繼續實作的阻擋：

- 首頁從不含匯率改為包含外幣兌台幣匯率。
- 舊版 ChatGPT browser handoff／人工帶回固定提示，改為工作台內 AI Chat、Task 與 Run 關聯，以及不要求使用者手動搬運固定 prompt。
- 新增 AI Execution Center，並以 Run、Node、Event、Log、Artifact、Human Gate 作為持久化執行模型。
- AI Summary 改為建立新的 Task 卡；原 Task 第一行記錄新卡位置，新卡頂部保留差異決策與已完成事項。
- High／Urgent 提醒新增提前 5 個工作日、3 日、1 日階段。

目前有兩項阻擋性規格缺口：

1. **Executor bridge 未定義**：PRD 要求工作台內 AI Chat 能建立並實際執行 Run，但尚未指定以哪個既有訂閱／本機程序／runner 連接 ChatGPT 或 Codex。Web 前端不能在沒有 bridge contract 的情況下自行驅動使用者訂閱帳號。現況會建立真實 Run，狀態停在 `waiting_external`，不會偽報成功。
2. **匯率來源未定義**：PRD 未指定銀行、現金／即期牌告類型與幣別清單。不同來源結果不同，因此不能自行選定產品資料源。

## 本批保留並延伸的實作

- 保留既有 Task、Board、Today、Calendar、Summary、Search、附件與資料維護成果，不重做已驗證功能。
- 新增 AI Execution Center 的資料表、RLS、RPC 與 UI：Run 清單、Graph、Timeline、Detail、Log、Artifact、Retry、Pause、Human Gate、Verification gate。
- AI Chat 建立 Task 時同步建立關聯 Run；Task 卡與詳細頁可開啟 Run。
- Run 成功前強制要求必要 Node 完成，且 Verification 明確通過。
- Retry 保留歷史；超過三次進入 `SYSTEM_ERROR_PAUSED`。配額暫停使用 `QUOTA_PAUSED`，resume 沿用同一 Run。
- Task relation 保存阻擋原因；Done 任務依本月、上月、Archive 分組。
- High／Urgent 任務產生 5 個中國工作日、3 日、1 日提醒，並以 dedupe key 防止重複通知。
- AI Summary 建立獨立 Task、雙向 relation，原 Task 第一行記錄摘要卡位置；既有不可變 Summary version index 繼續保留，供歷史搜尋使用。

## 尚未完成與發布邊界

- `202609220001_workflow_execution_center.sql` 與 `202609220002_priority_reminders.sql` 尚未套用 production。
- Executor bridge 與匯率來源待產品決策後才能完成對應 end-to-end flow。
- 新版 migration、正式站部署與 production smoke 尚未執行；本機與 CI 驗證不能替代 production 證據。
- GitHub push 仍受既有 authentication／permission failure 阻擋。依 Authentication Guardrail，不重複啟動 browser login、`gh auth login` 或 device verification；認證環境確認恢復後再推送目前 branch。

## 本機驗證

- Vitest：10 files、38 tests 通過。
- Playwright 全套：desktop／mobile 共 36 tests 通過。
- 最後 AI Chat、Workflow、Summary 變更 focused Playwright：desktop／mobile 共 12 tests 通過。
- TypeScript 與 Vite production build 通過，187 modules transformed。
- `git diff --check` 無 whitespace error；已確認本次變更未包含對話中曾出現的 Supabase project password。
