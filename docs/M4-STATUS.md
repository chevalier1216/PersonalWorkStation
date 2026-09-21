# M4 AI Chat + AI Task Actions Status

日期：2026-09-21

## 已實作

- Today 精簡 Chat 與完整 AI 對話頁共用持久化 conversation、messages 與 pending actions。
- server-side Edge Function 固定使用 OpenAI Responses API、`gpt-5.6-sol` 與 `xhigh` reasoning。
- 每個 conversation 保存 OpenAI conversation ID；後續 request 使用 conversation state。
- context 只載入有限筆數的 Task、Notes、Calendar cache，並明確當作不可信資料。
- AI 建立 Task 可直接執行；修改、刪除與 Calendar relation 必須在 UI 顯示內容並由使用者確認。
- 部分欄位修改會與目前 Task 合併，不會清除未指定欄位。
- OpenAI 中斷會保存失敗狀態與通知，Task／Board／Today 仍可操作。

## 驗證

- `npm test`：6 files / 21 tests passed。
- `npm run build`：passed；保留既有主 bundle 大於 500 kB 與第三方 zod 註解警告。
- `npx playwright test`：desktop + mobile 共 20 tests passed。
- E2E 已涵蓋 direct create、修改確認、刪除取消、history refresh、Calendar relation persistence 與 AI failure isolation。

## 成本與 production 界線

- 本次驗證未呼叫 OpenAI API，未新增 `OPENAI_API_KEY`，未部署 `ai-chat` Edge Function，也未套用 M4 production migration。
- OpenAI API 按 token 計費，沒有可依賴的固定免費額度。啟用 production 前必須依 Cost Guardrail 取得明確授權，並由使用者提供 API key。
- 因此 M4 本機垂直切片完成；production smoke test 仍待付費服務授權。
