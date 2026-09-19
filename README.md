# PersonalWorkStation

單人使用的 Web AI 工作臺。權威規格位於 [docs/product](docs/product/00-PRODUCT-OVERVIEW.md)，M1 計畫位於 [docs/M1-PLAN.md](docs/M1-PLAN.md)。

目前實作 M1：私人任務看板、快速建立、編輯／刪除、跨欄拖曳與選單搬移、排序、欄位管理，以及 Supabase 持久保存與狀態歷史。Task 詳細資料包含開始／截止日期、預估工時、交付物、標籤、Checklist、Activity / Notes 與任務關聯。這不代表完整 V1 或正式部署已完成。

## 本機啟動

需要 Node.js 22.12+ 或 24 LTS。

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Windows 可用 `Copy-Item .env.example .env.local`。在 `.env.local` 填入 Supabase URL 與 publishable key；不要填 service role 或資料庫密碼。開啟 `http://127.0.0.1:5173/PersonalWorkStation/`。

## Supabase 設定

1. 依序審查並以專案擁有者套用 `supabase/migrations/202609190001_board.sql` 與 `supabase/migrations/202609200001_task_details.sql`。正式環境須取得授權；每份 migration 僅執行一次，不可修改已套用版本後重跑。
2. 啟用 Google OAuth，Google redirect URI 使用 Supabase 提供的 callback URL。
3. Supabase Auth redirect allowlist 加入本機 URL；正式站點發布時再加入正式 URL。
4. 指定使用者首次登入後，在 Auth Users 取得其 UUID，再以管理者執行：

```sql
insert into public.allowed_users(user_id) values ('YOUR_USER_UUID');
```

`allowed_users` 是私人設定，不應將實際 UUID／email 寫入 repository。未列入的帳號無法讀取或操作 Board。表格開啟 RLS；authenticated 只有自己的資料讀取權，寫入集中透過檢查帳號的 `board_command` RPC，並以每個使用者的 transaction lock 序列化操作。不要在瀏覽器使用管理者憑證。

## 驗證

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

- `npm test` 使用 PGlite 的 PostgreSQL 引擎執行實際 migration、RLS、RPC、狀態歷史與回復測試。
- E2E 使用 `tests/fixture.html` 及同一 migration 的 PGlite 測試資料庫，驗證 UI 與重整保存；測試入口不會打包到正式產物。
- 上述測試不代表 Google OAuth、Supabase hosted integration 或 production smoke test 通過。這些需在實際專案設定完成後另行驗證。
- `.env.local`、測試輸出與 build output 均不提交。

## M1 邊界

欄位底層保留 todo / doing / done 語意；刪除前須選擇同狀態替代欄位。任務預設 Regular，僅需標題。進出 Doing 與完成狀態均保存歷史；移回未完成時清除目前完成時間，原始轉換歷史仍保留。Checklist 未全數完成時，移至 Done 會顯示一次警告，但允許確認完成。前置任務未完成時卡片保留「被阻擋」提示，仍允許移至 Doing。

今日首頁、循環任務／通知、Calendar、AI、附件／Archive 等按 `08-EXECUTION-RULES.md` 的後續 milestone 執行。尚未完成的能力不顯示假入口。main merge、GitHub Pages 發布及真實環境驗收需分別記錄。
