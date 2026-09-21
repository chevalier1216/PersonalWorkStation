# M5 — AI Summary + History Search

## 最小可驗證實作

1. 建立 AI Summary persistence：每份 Summary 使用 UUID 與 `v.YY.MM.DD.HHmm` 顯示版本；同分鐘追加 `-2`、`-3`。Summary 永不覆寫原 Task 或舊 Summary。
2. Task Activity 提供 `@AI 整理`。Server-side Edge Function 只讀該 Task、Notes、Checklist、狀態歷史與前一版 Summary；產生具體標題、版本差異區塊與完整摘要後再寫入資料庫。
3. Task 詳細頁顯示雙向關聯與版本時間軸。舊版第一行連至最新版；新版先顯示決策差異、已完成、已取消、已取代，再顯示完整摘要。
4. 建立歷史搜尋頁與資料庫 RPC。全域搜尋涵蓋 Task、Activity / Notes、Deliverable、Tags、Priority、Status、Date、Calendar relation、AI Conversation 與 AI Summary；可限制指定欄位。
5. Note 命中結果可直接開啟來源 Task，並捲動／標示命中的 Note。Chat 與 Summary 結果可開啟對應內容。
6. 外部 AI 失敗只顯示錯誤並建立通知，不修改 Task、既有 Summary 或搜尋資料。

## 驗證

- Database integration：RLS、搜尋欄位、Summary 版本與雙向關聯。
- Unit：搜尋與 Summary request 結構、版本顯示。
- Browser E2E：desktop + mobile 的 Note 定位、Chat 搜尋、Summary 建立、重整保存與版本鏈。
- `npm test`、`npm run test:e2e`、`npm run build`。

## Cost Guardrail

M5 本機與 CI 使用確定性 fixture，不呼叫 OpenAI。`ai-summary` Edge Function、migration、`OPENAI_API_KEY` 與真實 Responses API smoke 在取得明確費用授權前不得部署或執行。
