# M5 Status — AI Summary + History Search

## 已完成（本機與 CI-ready）

- Task Activity 提供 `@AI 整理`，Summary 使用獨立 persistence，不覆寫 Task。
- Summary 具體標題、`v.YY.MM.DD.HHmm` 版本、同分鐘序號、上一版／最新版關聯及差異區塊。
- Task 詳細頁顯示來源 Task、Summary 時間線與舊版第一行的最新版連結。
- 全域與指定欄位搜尋涵蓋 Title、Description、Activity / Notes、Deliverable、Tags、Priority、Status、Date、Calendar relation、AI Chat、AI Summary。
- Note 命中可直接開啟來源 Task 並定位／標示該 Note；Chat 命中可開啟正確 Conversation；Summary 命中可開啟來源 Task 與版本。
- AI context 可讀有限相關 Summary；只有使用者明確要求找舊對話時才檢索歷史 Chat。
- AI Summary 失敗會保存工作台通知，且不修改 Task 或既有 Summary。
- RLS 與 allowlist 保持單一指定使用者資料隔離。

## 驗證

- `npm run typecheck`：通過。
- `npm test`：8 files / 27 tests passed，包含 migration、RLS、搜尋欄位、Summary 版本鏈、有限 context 與 Edge request contract。
- `npm run test:e2e`：desktop + mobile 26/26 passed，涵蓋 M1–M5 回歸。
- `npm run build`：通過；保留既有主 bundle 大於 500 kB 的效能警告。

## Production 邊界

尚未套用 `202609210002_ai_summary_search.sql`、部署 `ai-summary`、設定 `OPENAI_API_KEY` 或執行真實 OpenAI Responses API smoke test。

OpenAI API 依輸入／輸出 token 計費，沒有可依賴的固定免費額度。依 Cost Guardrail，未取得使用者對可能新增費用的明確授權前，不得執行上述 production 操作。因此本文件只證明本機與瀏覽器垂直切片已完成，不宣稱 M5 production 完成。
