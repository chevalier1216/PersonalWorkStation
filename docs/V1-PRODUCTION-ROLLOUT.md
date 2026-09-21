# V1 Production Rollout

日期：2026-09-22

本文件記錄 production 實況、正式變更順序與完成證據。它不改動 `docs/product/` 的產品決策；若有衝突，仍以既定文件權威順序為準。

## 已確認的 production 基線

- Supabase project：`wcvaazjhkczdgtudssdl`，Free plan，production branch。
- M1、M2、M3 schema 與 Google Calendar production flow 已完成；M3 真實事件建立、relation persistence、失敗／重試與 refresh 已驗證。
- Edge Functions 目前只有 `refresh-holidays`。
- Edge Function custom secrets 目前為空；`refresh-holidays` 缺少 `HOLIDAY_SYNC_SECRET`，所以每週同步尚未啟用，不能把「已部署」視為自動維護完成。
- 2026-09-22 以 production catalog 唯讀查詢確認，下列資源全部不存在：
  - Tables：`ai_conversations`、`ai_messages`、`ai_pending_actions`、`ai_summaries`、`task_attachments`、`capacity_snapshots`、`metadata_backups`。
  - RPC：`ai_command`、`summary_command`、`history_search`、`attachment_command`。
  - Storage bucket：`pws-attachments`。
- 同次 migration preflight 已確認 `is_allowed()`、`tasks`、`task_notes`、`notifications`、`google_calendar_events`、`storage.objects`、8 個必要 Task detail 欄位、`workspace_command(text,jsonb)` 與 `workspace_command_core_m3(text,jsonb)` 全部存在；M4–M6 migration 的既有依賴已就緒。
- Git branch `feat/v1-specs-m1` 的 M1–M7 本機實作已推送至 `b9d623f50687b9283f9717dc9e19b2b168601961`；該 SHA 的 GitHub Actions、unit/integration、desktop/mobile Playwright 與 build 均通過。
- GitHub Actions 目前沒有 repository variables 或 repository secrets；`holiday-sync.yml` 與 Pages workflow 所需設定都尚未加入。
- GitHub Pages 目前為 disabled，publishing source 仍是 `Deploy from a branch`／`None`。Pages workflow 已存在，但尚未切換到 GitHub Actions、合併 `main` 或發布正式 URL。
- Supabase Auth 的 Site URL 仍為 `http://localhost:3000`，Redirect URLs 為空；正式 Pages URL 尚未加入 allowlist。
- Google Cloud project `project-workstation-509110` 的 Google Drive API 已於 2026-09-22 啟用並讀回確認狀態為「已啟用」；尚未重新取得指定帳號的 `drive.file` consent。

## Cost Guardrail

### 可在免費額度內執行

- Supabase Free project 內套用 schema、建立 private Storage bucket、部署 Edge Functions：不新增方案費用；仍受 Free plan Database 500 MB、Storage 1 GB、單檔 50 MB 與平台配額限制。
- Google Drive API：官方目前標準使用無額外費用；每日每 project 400,000,000 quota units 門檻內不收費。若政策改變、接近門檻或需開啟計費，必須先停止並取得新授權。
- GitHub Pages：目前 repository 為 public，可使用 GitHub Free Pages；若 repository／方案條件改變，發布前重新檢查。

### 會產生新增費用，尚未授權

- OpenAI API：依模型的 input、cached input 與 output token 計費，沒有可依賴的固定免費額度。最低實際費用取決於第一次真實 request 的 token 數，持續使用費用隨請求量與 token 數增加。
- 在使用者明確授權 OpenAI API 費用並提供 `OPENAI_API_KEY` 前，不得設定 secret、部署會被誤認為可用的 AI production flow，或執行真實 request。

## 變更順序

### Phase A — M4–M6 database 與 Storage

依序套用，任一步失敗即停止，不跳過：

1. `202609200005_ai_chat.sql`
2. `202609210001_restore_task_details_command.sql`
3. `202609210002_ai_summary_search.sql`
4. `202609210003_attachments_maintenance.sql`
5. `202609210004_attachment_storage_bucket.sql`

套用後以 catalog 查詢確認 7 tables、4 RPC 與 private bucket 全部存在，再以指定 Google 帳號檢查 RLS：authenticated owner 可操作自己的資料，anon 與其他 user 不可讀寫。

### Phase B — 免費外部整合

1. [完成] 在 Google Cloud project `project-workstation-509110` 啟用 Google Drive API，並讀回確認狀態為「已啟用」。
2. 讓指定帳號重新執行 Google OAuth consent，保留 Calendar scopes 並新增 `drive.file`。
3. 部署 `drive-archive` 與 `drive-maintenance`。
4. 執行真實附件 smoke：上傳 → archive → Drive metadata/size 讀回 → 工作台可重新開啟 → 最後才刪除 Storage 原件。
5. 執行 failure smoke，確認 Drive 失敗時 Storage 原件保留、通知存在、Retry 可用。
6. 執行容量與 metadata backup smoke，讀回 `PersonalWorkStation/Exports/YYYY/MM` 檔案並確認輸出不含 token、OAuth identifier 或 secret。
7. 為 `holiday-sync.yml` 設定既有 publishable key 與獨立 `HOLIDAY_SYNC_SECRET`，手動觸發一次並確認 `calendar_sync_runs` 成功，之後才保留每週排程。

### Phase C — OpenAI production（需另行費用授權）

1. 設定 `OPENAI_API_KEY` secret。
2. 部署 `ai-chat` 與 `ai-summary`。
3. 以最小真實 request 驗證固定模型 `gpt-5.6-sol`、`xhigh` reasoning、conversation persistence、direct create 與 modify confirmation。
4. 驗證 Summary 建立版本鏈、差異與雙向連結；原 Task 不變。
5. 模擬／確認 API failure 只建立失敗狀態與通知，Task、Board、Today 保持可用。

### Phase D — 正式 Web 發布

1. 設定 GitHub repository variables：`SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`。
2. 將 Pages publishing source 切換為 GitHub Actions。
3. 將 `https://chevalier1216.github.io/PersonalWorkStation/` 加入 Supabase Auth redirect allowlist。
4. 審查 feature branch diff 與 CI，取得 merge `main`／production deploy 明確授權。
5. 合併 `main`，等待 Pages workflow 成功並記錄正式 URL 與 deployed SHA。
6. 使用正式 URL 完成 `07-ACCEPTANCE-TESTS.md` 的 production smoke：登入、Today、Task CRUD／Board、Calendar、AI Chat、AI Summary、Search、附件／Drive、persistence、refresh 與錯誤隔離。

## 完成判定

只有 Phase A–D 全部有 production 證據，且正式 URL smoke 通過，才能將 PersonalWorkStation V1 標記完成。Local／CI 成功不可替代 OpenAI、Drive 與正式 Pages 驗證。

## 官方費用與配額來源

- Supabase Database size：https://supabase.com/docs/guides/platform/database-size
- Supabase Storage size：https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
- Supabase file limits：https://supabase.com/docs/guides/storage/uploads/file-limits
- Google Drive API limits：https://developers.google.com/workspace/drive/api/guides/limits
- Google Drive scopes：https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- GitHub Pages：https://docs.github.com/en/pages/getting-started-with-github-pages
