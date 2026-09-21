# M6 — Attachments + Drive Archive + Maintenance

## 最小可驗證實作

1. Task 與 Activity 可上傳附件；檔案本體先存私人 Supabase Storage bucket，Supabase 保存檔名、類型、大小、來源 Task／Note、存取時間與狀態。
2. 封存依序執行：上傳 Google Drive `PersonalWorkStation/Attachments/YYYY/MM`、讀回 Drive metadata 驗證、更新工作台 metadata/location、驗證工作台可取得 Drive link，最後才刪除 Storage 原件。
3. 任一步失敗都保留原件、保存失敗狀態並建立工作台通知；Retry 使用同一附件紀錄。
4. 封存後可從 Task 或 Archive Search 依 Filename、Source Task、Date、Metadata 找回並開啟。
5. 維護狀態保存 Supabase Database、Supabase Storage、Google Drive 容量 snapshot；接近 70% 顯示通知，不靜默刪除資料。
6. 定期 metadata/index backup 寫入 `PersonalWorkStation/Exports/YYYY/MM`，不包含 Secret、OAuth token 或檔案本體。

## 驗證

- Database integration：RLS、Task／Note 關聯、archive 狀態機、失敗保留原件、搜尋、容量與 backup metadata。
- Unit：Drive folder/upload/verify request contract 與備份內容排除 Secret。
- Browser E2E：desktop + mobile 上傳、refresh、Archive、重新開啟、failure/Retry。
- `npm test`、`npm run test:e2e`、`npm run build`。

## Production 邊界

Google Drive API 本身無額外使用費，但 production 需要啟用 API 並由指定 Google 帳號同意 `drive.file` OAuth scope。未完成帳號授權前，只實作與驗證本機 fixture，不宣稱真實 Drive Archive 完成。
