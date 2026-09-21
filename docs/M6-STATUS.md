# M6 Status — Attachments + Drive Archive + Maintenance

## 已完成（本機與 CI-ready）

- Task 與 Activity / Note 都可上傳多個附件；metadata、來源關聯與最後存取時間持久保存。
- 私人 Supabase Storage bucket migration 與 owner path RLS；Free 方案單檔 50 MB 上限在上傳前攔截。
- Drive Archive 固定使用 `PersonalWorkStation/Attachments/YYYY/MM`。
- 封存嚴格依序：讀取 Storage 原件、上傳 Drive、Drive metadata/size 讀回驗證、更新工作台 metadata/link、確認工作台可找回，最後才刪除原件。
- 任一步失敗會保留原件、保存錯誤與建立通知；同一附件可 Retry。
- Archive Search 可依 Filename、Source Task、Date、Metadata 找回並開啟來源 Task。
- 「儲存維護」顯示 Supabase Database、Supabase Storage、Google Drive 容量；70% 建立通知，不靜默刪除。
- App 啟動時每日檢查容量、每七日建立 metadata/index backup；備份只列已知資料欄位，排除 OAuth/OpenAI identifier 與 secret key。
- Backup 固定寫入 `PersonalWorkStation/Exports/YYYY/MM`，上傳後讀回驗證並保存可開啟連結。

## 驗證

- `npm run typecheck`：通過。
- `npm test`：10 files / 35 tests passed；涵蓋 RLS、Task/Note 關聯、封存狀態機、失敗保留、Retry、Archive Search、容量警示、backup due 與 Secret 欄位排除。
- M6 focused Playwright：desktop + mobile 6/6 passed，涵蓋上傳、refresh、Archive、搜尋、failure/Retry、容量與 backup persistence。
- 完整 Playwright：desktop + mobile 32/32 passed，M1–M6 回歸通過。
- `npm run build`：通過；保留既有主 bundle 大於 500 kB 的效能警告。

## Cost Guardrail 與 Production 邊界

- Google Drive API 官方目前說明：標準使用無額外費用；每日每 project 400,000,000 quota units 門檻內不收費，超額計費預計於 2026 年稍後實施且會提前至少 90 天公告。本產品單人每日／每週操作遠低於該門檻，但正式啟用前仍需明確授權，未來若接近門檻必須停止。
- Supabase Free：Database 500 MB、Storage 1 GB；Free 不收超額費用，但超限會受限制。附件單檔上限 50 MB。
- 尚未套用 M6 migrations、部署 `drive-archive`／`drive-maintenance`、讓指定帳號同意 `drive.file` scope 或執行真實 Drive smoke test。

### 2026-09-22 Production 前置更新

- Google Cloud project `project-workstation-509110` 的 Google Drive API 已在免費標準額度內啟用，並於 API/服務詳細資料讀回確認狀態為「已啟用」。
- M6 migrations、private bucket、`drive-archive`／`drive-maintenance`、指定帳號的 `drive.file` consent 與真實 Drive smoke test 仍未完成；因此 M6 production 狀態仍為未完成。

官方來源：

- https://developers.google.com/workspace/drive/api/guides/limits
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://supabase.com/docs/guides/platform/database-size
- https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
- https://supabase.com/docs/guides/storage/uploads/file-limits
