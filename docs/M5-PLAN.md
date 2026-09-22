# M5 — AI Summary Browser Handoff + Workspace History Search

## 最小可驗證實作

1. `@AI 整理` 只讀使用者目前開啟的 Task、Notes、Checklist、狀態歷史與前一版 Summary，產生 ChatGPT 一般對話的預填提示。
2. 使用者在 ChatGPT 確認 High 後送出，再回工作台建立 Summary Card；工作台不讀取或自動控制 ChatGPT 網頁。
3. Summary 使用 UUID 與 `v.YY.MM.DD.HHmm`，同分鐘追加 `-2`、`-3`，且不覆寫原 Task 或舊 Summary。
4. 工作台搜尋涵蓋 Task、Activity / Notes、Deliverable、Tags、Priority、Status、Date、Calendar relation 與 AI Summary。
5. ChatGPT conversation history 由 ChatGPT 自身保存與搜尋，不複製到 Supabase。
6. ChatGPT 不可達或使用者取消時，不修改 Task、既有 Summary 或搜尋資料。

## 驗證

- Database integration：RLS、工作台搜尋欄位、Summary 版本與雙向關聯。
- Unit：Summary handoff 提示、手動建立 payload 與版本顯示。
- Browser E2E：handoff、Summary 建立、重整保存、版本鏈、Note 定位與 mobile layout。

## 成本邊界

使用既有 ChatGPT 訂閱的一般對話額度；不使用 OpenAI API 或 Work 額度。
