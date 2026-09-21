# M4 — AI Chat + AI Task Actions 最小可驗證實作計畫

## 目標

以 server-side OpenAI Responses API 建立可持久保存的多輪 Chat，直接建立 Task，並讓修改、刪除與 Calendar relation 一律先顯示待確認動作。

## 垂直切片

1. Today 精簡 Chat 與完整 AI 對話頁共用 conversation persistence。
2. 每個 conversation 保存 OpenAI conversation ID；後續 request 使用 conversation state，不重送完整歷史。
3. 只查詢與使用者當前問題關聯的 Task／Notes／Calendar cache，限制筆數，不在每輪載入整個資料庫。
4. `create_task` tool 可直接透過既有 `workspace_command` 建立 Task。
5. 修改、刪除與 Calendar relation tool 只建立 `pending action`；UI 顯示具體內容，使用者確認後才執行。
6. OpenAI 不可達時保存使用者訊息與失敗狀態，Task／Board／Today 繼續可用。

## 驗證

- PostgreSQL：conversation、messages、pending action、跨 owner 防護與確認後才修改。
- Unit：Responses payload 固定使用 `gpt-5.6-sol`、`xhigh`、conversation state、有限 context 與 tool schema。
- Browser E2E：建立 conversation、多輪歷史、直接建立 Task、修改先確認、取消不修改、refresh persistence、AI failure isolation。
- Build、production migration、Edge Function deploy、真實 Responses API smoke test。

## 成本與部署界線

OpenAI API 按 token 計費且無可依賴的固定免費額度。Local tests 不呼叫 OpenAI。`OPENAI_API_KEY` secret、production Edge Function 與第一次真實 request 均等待 Cost Guardrail 明確授權。
