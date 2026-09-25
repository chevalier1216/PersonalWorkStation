# V1 Production Status

更新日期：2026-09-25

## 已驗證

- 本批功能 commit `fb759f2` 已推送至 `origin/feat/v1-specs-m1`。
- TypeScript、43 項 unit / database tests、38 項 desktop / mobile Playwright tests、production build 通過。
- 本機 Executor bridge 可啟動，`http://127.0.0.1:4317/health` 曾回傳 `ok: true`；production Run 已實際交付 Codex CLI，成功路徑仍待驗證。
- Supabase production 已套用 `202609230001_exchange_rates.sql`。
- Supabase production 已部署 `refresh-exchange-rates`。
- Dashboard production smoke 回傳 HTTP 200：`{"ok":true,"count":5}`。
- GitHub repository variables `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY` 已設定於 repository scope；未使用 `service_role`。
- GitHub Pages 已由 workflow run `35855651455` 成功建置與部署 commit `7543ecd`：<https://chevalier1216.github.io/PersonalWorkStation/>。
- Supabase Auth Site URL 與 redirect allowlist 已設定為正式 Pages URL。
- 正式站已完成 Google 登入，Today、既有 Task、Calendar、通知與 AI Execution 模組均可載入。
- 正式站匯率模組顯示玉山官方 USD、RMB/CNY、JPY、EUR、AUD 的即期與現金買入／賣出及更新時間。
- GitHub issue #2 的 runtime variables / Pages deployment 問題已修復；workflow 的 configuration check、build、artifact upload 與 deploy 均成功。
- GitHub issue #1 已新增 `202609230002_today_preferences_module_guard.sql` 並套用 production。正式站將玉山匯率模組上移、顯示「已儲存」、重新整理後保持順序，再還原原版面，確認 constraint 不再阻擋目前 V1 module keys。
- GitHub issues #1、#2 已確認完成並關閉。
- 2026-09-25 再次核對 issues #1、#2：`202609230002_today_preferences_module_guard.sql` 保留全部 V1 Today 模組並拒絕未知 key；定向資料庫測試 1/1、Today 桌面／手機 E2E 4/4 通過。這是本機回歸驗證；production 排序保存的實測證據仍為上述先前紀錄。
- GitHub Pages workflow run `36078527439` 已成功將目前工作分支 commit `3b09f2bdc12862cf67f63a9c2f032b55a63ad8ba` 發布至 <https://chevalier1216.github.io/PersonalWorkStation/>；`Verify public runtime configuration`、Build、artifact upload 與 Deploy 均成功，issue #2 的設定故障未重現。此處驗證的是部署工作流程；本次尚未重新操作正式站登入後畫面。
- `202609220001_workflow_execution_center.sql` 與 `202609220002_priority_reminders.sql` 已套用 production；真實建立 `RUN-20260923-0001` 證實 production RPC 與 workflow schema 可用。
- Pages workflow run `35857373736` 已成功部署 commit `c692000`，補上 production HTTPS 頁面連線 loopback bridge 所需的 Local Network Access 標記與 bridge CORS opt-in。
- Pages workflow run `35857954288` 已成功部署 commit `eaf569a`；Windows bridge 改用可直接 spawn 的 `codex.exe`，並讓 Retrying Run 可再次交給本機 Executor。
- `RUN-20260923-0001` 的第一次真實交付已回寫 Context success、Execution running、Log「已交付本機 Codex CLI」與 `spawn EINVAL` failure；這證實 bridge、RPC、Node 與 Log 的錯誤路徑能端到端回寫。上述 Windows spawn 問題已在 `eaf569a` 修正。
- Supabase production 已套用 `202609210002_ai_summary_search.sql`、`202609210003_attachments_maintenance.sql`、`202609210004_attachment_storage_bucket.sql`。`supabase/verification/m4_m6_postflight.sql` 的 22 項檢查全部通過，涵蓋表、函式、RLS、授權、私人 bucket 與 Storage policies。
- Supabase production 已部署 `drive-archive` 與 `drive-maintenance`；Functions 清單現有這兩項與 `refresh-exchange-rates`、`refresh-holidays`，共 4 項。
- `drive-maintenance` 的 helper 已改為函式目錄內依賴，commit `e5c6631` 已推送目前分支；focused helper tests 3/3 通過。
- 正式站 AI 摘要頁已可讀取 0 份摘要，Task 詳細資料可載入附件區與摘要建立表單，證明新增 schema 的基本讀取路徑可用。
- 本機 Executor 第二次交付已進入 Codex CLI，並將 `--sandbox` 與 `--approve-for-me` 互斥參數錯誤回寫到舊 Run；其後修正與成功路徑見下方新 Run 紀錄。
- 已推送 `7165fe7` 修正 CLI 互斥參數與唯讀 Run 的提示，`4fd1583` 傳遞本機 `CODEX_HOME`。正式站新建唯讀 `RUN-20260925-0001`，交給本機 Codex CLI 後成功回寫；Graph 的 Trigger、Context、Execution、Verification、Output 全部為 Success，Task 可雙向開啟該 Run。此 Run 未修改檔案或發布。
- 正式站已為該 Task 建立摘要版本 `v.26.09.25.0050` 與關聯摘要任務卡；摘要原文、來源與版本顯示於 Task 詳細資料。
- 最近兩次 V1 verification workflow 在 `npm run build` 失敗，原因是 `codexExecArgs` 缺少 `.d.mts` 型別宣告。`e382c05` 已補上宣告，遠端 V1 verification run `36030383586` 的 unit、desktop/mobile E2E、build 全部通過。
- `7515273` 讓 AI Chat 的需求文字在 Task 說明留空時直接寫入 Task 與 Run，保留手動說明覆寫；desktop/mobile focused E2E 2/2、production build、遠端 V1 verification run `36031937135` 全部通過，已推送工作分支。
- 指定 Google Drive 版本文件已追加本批 Executor、migration、Functions、smoke、CI 與未驗證項目，並讀回核對：<https://docs.google.com/document/d/1xCYBrIw6dH4eF2gJM7nxN4WiaP4bPQp17fOgqFYEALQ/edit>。

## 尚未驗證／人工 blocker

- 舊 `RUN-20260923-0001` 因三次失敗已 Paused，保留完整錯誤歷史；成功路徑由新 Run 驗證。
- 歷史 Search 查詢、Drive 附件封存／維護的 production 寫入路徑尚未完成 smoke；Google Drive OAuth 權限是否仍有效也待實測。開啟正式站歷史紀錄時，瀏覽器自動審查拒絕額外網域存取；未改用其他瀏覽器途徑繞過。
- AI Chat 目前仍以新瀏覽器分頁開啟 ChatGPT；使用者要求的「工作台內瀏覽器對話」尚未完成，不以既有連結或固定 Prompt 視為完成。
- `gh` 預設登入仍回傳 HTTP 401；本次改用本機既有 Git Credential Manager 憑證，僅在當次程序記憶體提供給 GitHub CLI，成功觸發 Pages workflow。未重新登入、未儲存新 token。若該憑證日後失效，需重新評估 GitHub 授權。

## 下一個必要步驟

1. 取得正式站網域瀏覽器存取授權後，確認新版本的登入後畫面，並完成歷史 Search 與 Drive 封存／維護的 production smoke；需要本人 Google OAuth 操作時記為 manual blocker。
2. 依已確認的 V1「工具內瀏覽器對話」需求解決 AI Chat 平台限制，驗證對話到 Task／Run 的端到端交接。
