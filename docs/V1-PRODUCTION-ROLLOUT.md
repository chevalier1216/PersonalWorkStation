# V1 Production Rollout

> 歷史 rollout 基線：本文件保留舊版 M1–M7 的 production 證據與未完成部署事項。自 `ver.26.09.22.1516` 起，產品完成判定改以 `docs/product/00_PRD_INDEX.md` 所列新版 PRD 為準；本文件不得用來宣稱新版 AI Execution Center 已完成。

日期：2026-09-22

本文件記錄 production 實況、正式變更順序與完成證據。它不改動 `docs/product/` 的產品決策；若有衝突，仍以既定文件權威順序為準。

## 已確認的 production 基線

- Supabase project：`wcvaazjhkczdgtudssdl`，Free plan，production branch。
- M1、M2、M3 schema 與 Google Calendar production flow 已完成；M3 真實事件建立、relation persistence、失敗／重試與 refresh 已驗證。
- Edge Functions 目前只有 `refresh-holidays`。
- Edge Function custom secrets 目前為空；`refresh-holidays` 缺少 `HOLIDAY_SYNC_SECRET`，所以每週同步尚未啟用，不能把「已部署」視為自動維護完成。
- 2026-09-22 以 production catalog 唯讀查詢確認，下列資源全部不存在：
  - Tables：`ai_summaries`、`task_attachments`、`capacity_snapshots`、`metadata_backups`。
  - RPC：`summary_command`、`history_search`、`attachment_command`。
  - Storage bucket：`pws-attachments`。
- 同次 migration preflight 已確認 `is_allowed()`、`tasks`、`task_notes`、`notifications`、`google_calendar_events`、`storage.objects`、8 個必要 Task detail 欄位、`workspace_command(text,jsonb)` 與 `workspace_command_core_m3(text,jsonb)` 全部存在；M4–M6 migration 的既有依賴已就緒。
- `storage.objects` 目前沒有 `pws_attachment_insert`、`pws_attachment_select` 或 `pws_attachment_delete` 同名 policy，建立 private bucket 與三項 owner-path policy 不會遇到名稱衝突。
- Git branch `feat/v1-specs-m1` 的 M1–M7 本機實作已推送至 `b9d623f50687b9283f9717dc9e19b2b168601961`；該 SHA 的 GitHub Actions、unit/integration、desktop/mobile Playwright 與 build 均通過。
- Production rollout 測試已重現 M3 command wrapper 已存在的實際基線；M5–M6 schema 可在單一 transaction 內完整套用，且注入失敗時全部回滾。修正後測試數以最新 CI 為準。
- GitHub Actions 目前沒有 repository variables 或 repository secrets；`holiday-sync.yml` 與 Pages workflow 所需設定都尚未加入。
- GitHub Pages 目前為 disabled，publishing source 仍是 `Deploy from a branch`／`None`。Pages workflow 已存在，但尚未切換到 GitHub Actions、合併 `main` 或發布正式 URL。
- Supabase Auth 的 Site URL 仍為 `http://localhost:3000`，Redirect URLs 為空；正式 Pages URL 尚未加入 allowlist。
- Google Cloud project `project-workstation-509110` 的 Google Drive API 已於 2026-09-22 啟用並讀回確認狀態為「已啟用」；尚未重新取得指定帳號的 `drive.file` consent。
- Google Auth Platform 目前為 External／Testing，指定 Google 帳號是唯一 test user；Data Access 尚未登記任何 OAuth scope。V1 不需要公開給其他帳號，但正式 smoke 前必須加入 Calendar 與 `drive.file` scopes，並由指定帳號重新 consent。

## Cost Guardrail

### 可在免費額度內執行

- Supabase Free project 內套用 schema、建立 private Storage bucket、部署 Edge Functions：不新增方案費用；仍受 Free plan Database 500 MB、Storage 1 GB、單檔 50 MB 與平台配額限制。
- Google Drive API：官方目前標準使用無額外費用；每日每 project 400,000,000 quota units 門檻內不收費。若政策改變、接近門檻或需開啟計費，必須先停止並取得新授權。
- GitHub Pages：目前 repository 為 public，可使用 GitHub Free Pages；若 repository／方案條件改變，發布前重新檢查。

### ChatGPT V1 額度

- AI 功能使用既有 ChatGPT 訂閱的一般對話額度，不新增 API token 費用。
- 禁止切換 Work、使用 OpenAI API、購買 credits 或自動升級方案。
- 一般對話額度接近上限或 High 不可用時，停止並依 Cost Guardrail 通知使用者。

## 變更順序

> 下列 Phase A–D 是舊版 rollout 基線。新版 PRD 的新增項目依 Phase E 執行；凡與 `docs/product/00_PRD_INDEX.md` 衝突的舊步驟均已被取代。

### Phase A — M4–M6 database 與 Storage

依序套用，任一步失敗即停止，不跳過：

1. `202609210001_restore_task_details_command.sql`
2. `202609210002_ai_summary_search.sql`
3. `202609210003_attachments_maintenance.sql`
4. `202609210004_attachment_storage_bucket.sql`

套用後執行 `supabase/verification/m4_m6_postflight.sql`；所有 row 必須為 `passed=true`，以確認 4 tables、3 RPC、RLS、anon revoke、private bucket 與三項 Storage policy。再以指定 Google 帳號檢查 authenticated owner 可操作自己的資料，其他 user 不可讀寫。

### Phase B — 免費外部整合

1. [完成] 在 Google Cloud project `project-workstation-509110` 啟用 Google Drive API，並讀回確認狀態為「已啟用」。
2. 在 Google Auth Platform Data Access 登記 `calendar.calendarlist.readonly`、`calendar.events` 與 `drive.file`；維持單一 test user，不公開給其他帳號。
3. 讓指定帳號重新執行 Google OAuth consent，保留 Calendar scopes 並新增 `drive.file`。
4. 部署 `drive-archive` 與 `drive-maintenance`。
5. 執行真實附件 smoke：上傳 → archive → Drive metadata/size 讀回 → 工作台可重新開啟 → 最後才刪除 Storage 原件。
6. 執行 failure smoke，確認 Drive 失敗時 Storage 原件保留、通知存在、Retry 可用。
7. 執行容量與 metadata backup smoke，讀回 `PersonalWorkStation/Exports/YYYY/MM` 檔案並確認輸出不含 token、OAuth identifier 或 secret。
8. 為 `holiday-sync.yml` 設定既有 publishable key 與獨立 `HOLIDAY_SYNC_SECRET`，手動觸發一次並確認 `calendar_sync_runs` 成功，之後才保留每週排程。

### Phase C — ChatGPT 一般對話 browser handoff（歷史，已被新 PRD 取代）

1. [本機完成] 移除舊 `ai-chat`、`ai-summary` API flow、Chat persistence migration 與付費 API request contract。
2. 驗證所有 AI 入口只開啟 ChatGPT 一般「對話」，且提示已預填。
3. 以指定帳號確認顯示 High；不得進入 Work，也不得自動送出。
4. 驗證 Task 建議必須回到工作台確認後才改資料。
5. 驗證 Summary 可由使用者帶回建立版本鏈、差異與雙向連結，原 Task 不變。
6. 驗證 popup blocked／ChatGPT 不可達時 Task、Board、Today 保持可用。

### Phase D — 正式 Web 發布

1. 設定 GitHub repository variables：`SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`。
2. 將 Pages publishing source 切換為 GitHub Actions。
3. 將 `https://chevalier1216.github.io/PersonalWorkStation/` 加入 Supabase Auth redirect allowlist。
4. 審查 feature branch diff 與 CI，取得 merge `main`／production deploy 明確授權。
5. 合併 `main`，等待 Pages workflow 成功並記錄正式 URL 與 deployed SHA。
6. 使用正式 URL 完成 `docs/product/07_ACCEPTANCE_AND_ROADMAP.md` 的 production smoke：登入、Today、Task CRUD／Board、Calendar、AI Chat、AI Execution、AI Summary、Search、附件／Drive、persistence、refresh 與錯誤隔離。

### Phase E — PRD ver.26.09.22.1516

1. 在測試環境依序套用 `202609220001_workflow_execution_center.sql`、`202609220002_priority_reminders.sql`，驗證 owner isolation、Run／Node／Event／Log／Artifact／Human Gate、提醒去重與 Summary Task relation。
2. 套用 production 前再次確認 Supabase Free 配額與 migration preflight；正式套用需要既有 production 發布授權仍有效，並記錄 schema readback。
3. 取得 executor bridge 產品決策後，完成 AI Chat → Task → Run → Verification → Artifact 的真實 end-to-end flow；沒有 bridge 時 Run 必須停在 `waiting_external`。
4. 取得匯率來源、牌告型態與幣別決策後，才實作 Today 匯率模組及其 cache／failure isolation。
5. 依 `docs/product/07_ACCEPTANCE_AND_ROADMAP.md` 重新執行新版 desktop、mobile 與 production smoke。

## 完成判定

只有新版 authoritative acceptance 可執行項目全部有 production 證據，且 Phase E 的兩項規格缺口已完成決策與驗證，才能將 PersonalWorkStation V1 標記完成。Local／CI 成功不可替代 executor bridge、Drive 與正式 Pages 驗證。

## 官方費用與配額來源

- Supabase Database size：https://supabase.com/docs/guides/platform/database-size
- Supabase Storage size：https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
- Supabase file limits：https://supabase.com/docs/guides/storage/uploads/file-limits
- Google Drive API limits：https://developers.google.com/workspace/drive/api/guides/limits
- Google Drive scopes：https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- GitHub Pages：https://docs.github.com/en/pages/getting-started-with-github-pages
