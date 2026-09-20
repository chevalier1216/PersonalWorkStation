# M3 Google Calendar Status

日期：2026-09-20

## 已實作

- Google OAuth 登入請求 Calendar scope；access token 只存在使用者 session，未寫入資料庫、repository 或 log。
- 讀取 Calendar 清單，保存使用者選擇並快取最近成功同步的事件。
- Today 顯示今天與未來五個中國實際工作日的行程；有時間 Task 與 Calendar event 依時間混排，無時間 Task 排在當日底部。
- Task 有截止時間時建立 timed event，只有開始日期時建立 all-day event。
- Task ID 寫入 Google event private extended property；Retry 先查既有 event，避免重複建立。
- 一 Task 最多一個 V1 event relation；link table 使用獨立主鍵，未來可移除唯一約束擴充一對多。
- API 失敗時保留 Task 與最近成功快取、寫入通知、保存 failed relation 並顯示 Retry。
- Task 完成不修改或刪除 Google event。

## 本機驗證

- `npm run typecheck`：passed。
- `npm test`：4 files / 16 tests passed。
- `npm run test:e2e`：desktop + mobile 共 14 tests passed。
- `npm run build`：passed；仍有主 bundle 大於 500 kB 與第三方 zod 註解警告。

## Production migration

- 2026-09-20 已取得明確發布授權，並將 `202609200004_google_calendar.sql` 套用至 Supabase project `wcvaazjhkczdgtudssdl`。
- Schema readback：`google_calendars`、`google_calendar_events`、`task_calendar_links`、`google_calendar_sync_state` 均存在，4 張表的 RLS 全部啟用，4 條 owner policy 均存在。
- `authenticated` 可執行 `workspace_command(text,jsonb)`；既有 4 筆 Task 與 3 個 Board 欄位仍可讀取。
- Production-backed 工作臺已成功載入 Calendar 模組與既有 Task／通知；尚未建立真實 Google Calendar event。

## 成本

- Google Calendar API 標準使用目前無額外費用。
- 官方門檻：每日每專案 1,000,000 requests；本功能只由單一使用者手動同步，未申請 quota increase、未啟用付費資源。
- Google 預告 2026 年稍後可能對超額請求收費；接近門檻或政策改變時必須依 Cost Guardrail 停止並通知。
- 官方來源：https://developers.google.com/workspace/calendar/api/guides/quota

## 尚未完成／未驗證

- Google Cloud project `project-workstation-509110` 已確認 Calendar API 尚未啟用；啟用頁明示會接受 Google APIs 與 Calendar API 服務條款，等待使用者在最後動作前明確確認。
- 指定 Google 帳號尚未重新同意 Calendar scope。
- 尚未以真實 Google Calendar 完成建立事件、relation persistence、failure／Retry 與 production refresh smoke test。
- 因此 M3 尚未達到 `07-ACCEPTANCE-TESTS.md` 的正式完成定義。
