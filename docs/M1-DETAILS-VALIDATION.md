# 2026-09-20 M1 Task 詳細資料驗證

## Hosted smoke test

- 重新走 Google OAuth 後，指定帳號通過 `public.allowed_users`。
- 真實 Supabase 成功建立「M1 雲端驗證 · 2026-09-20」、修改說明與優先度、Todo → Doing → Done，重整後仍保存，並產生完成時間。
- 該驗證任務保留在 Done 作為實際驗收紀錄。

以上只驗證第一份 migration 的 hosted 流程。第二份詳細資料 migration 尚未套用 production。

## 第二段本機實作

- Task：開始日期、截止時間、預估分鐘、交付物類型與內容。
- 自訂文字＋顏色標籤。
- Checklist：標題、完成狀態、選填截止日期；未完成時移至 Done 顯示一次確認。
- Activity / Notes：時間序列紀錄。
- 前置／後續／相關任務；前置未完成時顯示阻擋來源，仍可移至 Doing。
- 依完整狀態歷史計算 Doing 原始經過時間，不覆蓋原始事件。
- 所有子資料均受 owner foreign key、RLS 與 security-definer RPC 邊界保護；刪除任務時 cascade 清理。

## 驗證邊界

- PGlite 執行兩份實際 migration 與 RPC，不以 mock 宣稱 persistence 完成。
- 6 個資料庫／相容性案例與 8 個 Chromium 桌面／手機 E2E 通過；production build 與 npm audit 通過。
- 第二份 migration 套用前，前端會把舊 snapshot 缺少的子資料集合正規化為空陣列，既有 Task / Board 不會因版本差異中斷。
- production 套用第二份 migration 前，hosted 詳細欄位仍不可用。
- Attachments、Recurring、Today／通知、搜尋與 AI 調整工時按後續里程碑執行。
