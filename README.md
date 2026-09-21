# PersonalWorkStation

單人使用的 Web AI 工作臺。權威規格位於 [docs/product](docs/product/00-PRODUCT-OVERVIEW.md)，各 Milestone 計畫與交付證據位於 `docs/`。

目前狀態：

- M1 Task / Board / Persistence 與 M2 Today / Notification / Recurring 已完成 production 驗證。
- M3 Google Calendar 已完成 production migration、指定帳號 OAuth 與實際 event smoke test。
- M4 AI Chat / AI Task Actions、M5 AI Summary / History Search、M6 Attachments / Drive Archive / Maintenance 已完成程式、資料庫 migration／Edge Function source 與本機自動驗證；尚未部署相關 production migration／Edge Functions。OpenAI API 未取得付費授權，因此未設定金鑰或執行真實付費呼叫。
- M7 Responsive / UI Polish / Production Hardening 已補齊七個主導覽頁面及 GitHub Pages workflow；正式站必須在 production 設定、合併、部署與 smoke test 後才算完成。

詳細狀態見 `docs/M2-PRODUCTION-STATUS.md`、`docs/M3-STATUS.md`、`docs/M4-STATUS.md`、`docs/M5-STATUS.md`、`docs/M6-STATUS.md` 與 `docs/M7-STATUS.md`。

## 本機啟動

需要 Node.js 22.12+ 或 24 LTS。

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Windows 可用 `Copy-Item .env.example .env.local`。在 `.env.local` 填入 Supabase URL 與 publishable key；不要填 service role 或資料庫密碼。開啟 `http://127.0.0.1:5173/PersonalWorkStation/`。

## Supabase 設定

1. 依檔名順序審查並以專案擁有者套用 `supabase/migrations/`。正式環境須取得授權；每份 migration 僅執行一次，不可修改已套用版本後重跑。各 Milestone 狀態文件會標示哪些版本尚未套用 production。
2. 啟用 Google OAuth，Google redirect URI 使用 Supabase 提供的 callback URL。
3. Supabase Auth redirect allowlist 加入本機 URL；正式站點發布時再加入正式 URL。
4. 指定使用者首次登入後，在 Auth Users 取得其 UUID，再以管理者執行：

```sql
insert into public.allowed_users(user_id) values ('YOUR_USER_UUID');
```

`allowed_users` 是私人設定，不應將實際 UUID／email 寫入 repository。未列入的帳號無法讀取或操作工作臺。表格開啟 RLS；authenticated 只有自己的資料讀取權，寫入集中透過檢查帳號的 `workspace_command` RPC（Board 操作再委派給 `board_command`），並以每個使用者的 transaction lock 序列化操作。不要在瀏覽器使用管理者憑證。

## 驗證

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

- `npm test` 使用 PGlite 的 PostgreSQL 引擎執行實際 migration、RLS、RPC、狀態歷史、循環任務、通知、官方行事曆原子替換、Google Calendar 快取／relation／failure isolation 測試。
- E2E 使用 `tests/fixture.html` 及同一 migration 的 PGlite 測試資料庫，驗證 UI 與重整保存；測試入口不會打包到正式產物。
- 本機自動測試本身不代表 hosted integration 通過；M1-M3 的 production 證據分別記錄在狀態文件。M4-M7 與正式 GitHub Pages 仍需完成各自的 production 驗證。
- `.env.local`、測試輸出與 build output 均不提交。

## GitHub Pages

正式發布 workflow 只在 `main` 或人工觸發時執行。Repository variables 必須包含：

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

兩者會打包至瀏覽器，僅能使用 publishable key；不得設定 service role 或資料庫密碼。正式發布還需將 Pages URL 加入 Supabase Auth redirect allowlist。
