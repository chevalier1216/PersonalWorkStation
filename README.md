# PersonalWorkStation

單人使用的 Web AI 工作臺。權威規格入口是 [00_PRD_INDEX.md](docs/product/00_PRD_INDEX.md)，版本為 `ver.26.09.22.1516`。各階段計畫與交付證據位於 `docs/`。

目前狀態：

- M1 Task / Board / Persistence 與 M2 Today / Notification / Recurring 已完成 production 驗證。
- M3 Google Calendar 已完成 production migration、指定帳號 OAuth 與實際 event smoke test。
- 舊版 M4–M7 已完成的 browser handoff、Summary、搜尋、附件、封存、responsive 與 Pages workflow 保留為既有成果。新版 AI Execution Center 的 Run／Node／Graph／Timeline／Human Gate 與本機 executor bridge 已實作；匯率 production migration、Edge Function 部署與五幣別 smoke 已完成。
- 正式站已部署新版前端，Google 登入、Today、Calendar、AI Execution、玉山五幣別匯率與 Today 排序 persistence 已完成 production smoke。真實本機 Codex Run 尚未執行，因該步驟會消耗使用者的 Codex 訂閱額度。

舊版完成證據仍見 `docs/M2-PRODUCTION-STATUS.md` 至 `docs/M7-STATUS.md`；這些是歷史實作紀錄，不覆寫新版 authoritative PRD。

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
3. Supabase Auth redirect allowlist 加入本機 URL 與 `https://chevalier1216.github.io/PersonalWorkStation/`；Site URL 使用正式 Pages URL。
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
- 本機自動測試本身不代表 hosted integration 通過；M1-M3 的 production 證據分別記錄在狀態文件。修正後的 M4-M7 與正式 GitHub Pages 仍需完成各自的 production 驗證。
- `.env.local`、測試輸出與 build output 均不提交。

## GitHub Pages

正式發布 workflow 只在 `main` 或人工觸發時執行。Repository variables 必須包含：

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

兩者會打包至瀏覽器，僅能使用 publishable key；不得設定 service role 或資料庫密碼。正式發布還需將 Pages URL 加入 Supabase Auth redirect allowlist。
## 本機 Executor bridge

AI 執行中心以本機 Codex CLI 執行 Run，不使用 OpenAI API key。先確認已在本機登入 Codex，於 repository root 執行：

```powershell
npm run executor:local
```

bridge 僅監聽 `127.0.0.1:4317`，預設接受本機開發頁與 `https://chevalier1216.github.io`。若正式站改用其他 origin，啟動前以 `PWS_ALLOWED_ORIGINS` 明確加入。執行會使用目前 Codex 訂閱額度；接近用量上限時應暫停 Run。

## 玉山外幣匯率

Today 的匯率模組由 `refresh-exchange-rates` Edge Function 讀取玉山銀行官方頁面，顯示 USD、RMB/CNY、JPY、EUR、AUD 的即期與現金買入／賣出。同步失敗會保留最後成功快取。Production 已套用 `202609230001_exchange_rates.sql` 並部署該 Edge Function；不需要新增付費服務。
