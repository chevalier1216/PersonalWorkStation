# Technical Architecture

## Frontend

建議：

- React
- TypeScript
- Vite
- React Router
- Tailwind CSS / CSS Variables
- dnd-kit
- TanStack Query
- Zod

若 repo 實際環境有更合適且成熟的既有方案，可調整，但不得因此增加不必要重構。

## Backend

- Supabase PostgreSQL
- Supabase Auth
- Supabase Edge Functions
- Server-side schedules

## External

- ChatGPT 一般對話網頁（瀏覽器 handoff；使用既有訂閱）
- Google OAuth
- Google Calendar API
- Google Drive API

V1 不使用 OpenAI API，也不開啟 ChatGPT Work。Frontend 只產生最小必要提示並以新分頁開啟 `chatgpt.com`；不得把 ChatGPT 頁面嵌入 iframe、讀取其 DOM、代替使用者送出，或宣稱可強制設定網頁模型。

## Hosting

Frontend：

GitHub Pages。

不要求自訂網域。

如果實際中國使用環境證明 GitHub Pages 長期不可用，可改 Static Hosting，但不得要求重寫 App。

## Auth

V1：

Google OAuth 單一指定使用者。

Session 持久保存。

Google 暫時不可達但既有 Session 仍有效：

不得阻止核心工作台使用。

未來保留加入：

飛書中國版登入。

V1 不實作。

## Mainland China Resilience

Google / ChatGPT 暫時不可達時：

核心功能仍應可以：

- 開啟
- 查看已同步 Task
- 編輯 Task
- 操作 Board
- 查看既有 Notes

外部功能顯示同步失敗即可。

## Failure Isolation

任何外部 Integration 失敗不得：

- 刪除 Task
- rollback 已成功本地操作
- 阻止 Board 使用
- 拖垮整個 App

## Security

Public repo 禁止包含：

- `.env`
- Google client secret
- Google OAuth token
- Supabase service role
- Personal settings
- Private data

允許：

- Source
- Migration
- Edge Function source
- `.env.example`
- Docs

Client-side 不得暴露 server secret。

ChatGPT 網頁使用使用者既有登入狀態；PersonalWorkStation 不保存 ChatGPT cookie、token 或帳號憑證。
