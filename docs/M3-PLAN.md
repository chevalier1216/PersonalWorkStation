# M3 — Google Calendar 最小可驗證實作計畫

## 目標

在不影響 Task／Board 可用性的前提下，完成 Google Calendar 的選擇、顯示、Task 建立事件、關聯、失敗通知與 Retry。

## 垂直切片

1. 以既有 Google OAuth session 的 provider access token 呼叫 Calendar API；token 不寫入資料庫、repository 或 log。
2. 保存 Calendar 選擇、最近成功同步的事件快取、Task event relation 與同步狀態。
3. Today 以今天與未來五個中國實際工作日顯示快取事件，並將有時間 Task 與 event 依時間混排；無時間 Task 放當日底部。
4. Task 有 `due_at` 時建立 timed event；只有 `start_date` 時建立 all-day event。一 Task 在 V1 最多一個 event relation。
5. Calendar API 或 relation persistence 失敗時保留 Task、保留最後成功快取、建立工作臺通知並提供 Retry。
6. 以 Task ID 寫入 Google event private extended property，Retry 先查既有 event，避免重複建立。

## 驗證

- PostgreSQL migration／RLS／RPC：Calendar 選擇、快取、relation、成功與失敗狀態。
- Unit：事件時間模型、API 正規化與 Retry 去重。
- Browser E2E：Calendar 顯示、選擇、Task 建立 relation、failure notification、Retry、refresh persistence。
- TypeScript、build、production migration readback、指定 Google 帳號建立真實 Calendar event。

## 成本界線

Google Calendar API 標準使用目前無額外費用；每日每專案 1,000,000 requests 內不計費。本產品限制為手動同步與單人使用，不申請付費 quota increase。若 Google 的 2026 計費政策生效或接近免費門檻，必須停止並依 Cost Guardrail 通知使用者。
