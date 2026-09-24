# V1 Production Status

更新日期：2026-09-24

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
- `202609220001_workflow_execution_center.sql` 與 `202609220002_priority_reminders.sql` 已套用 production；真實建立 `RUN-20260923-0001` 證實 production RPC 與 workflow schema 可用。
- Pages workflow run `35857373736` 已成功部署 commit `c692000`，補上 production HTTPS 頁面連線 loopback bridge 所需的 Local Network Access 標記與 bridge CORS opt-in。
- Pages workflow run `35857954288` 已成功部署 commit `eaf569a`；Windows bridge 改用可直接 spawn 的 `codex.exe`，並讓 Retrying Run 可再次交給本機 Executor。
- `RUN-20260923-0001` 的第一次真實交付已回寫 Context success、Execution running、Log「已交付本機 Codex CLI」與 `spawn EINVAL` failure；這證實 bridge、RPC、Node 與 Log 的錯誤路徑能端到端回寫。上述 Windows spawn 問題已在 `eaf569a` 修正。
- Supabase production 已套用 `202609210002_ai_summary_search.sql`、`202609210003_attachments_maintenance.sql`、`202609210004_attachment_storage_bucket.sql`。`supabase/verification/m4_m6_postflight.sql` 的 22 項檢查全部通過，涵蓋表、函式、RLS、授權、私人 bucket 與 Storage policies。
- Supabase production 已部署 `drive-archive` 與 `drive-maintenance`；Functions 清單現有這兩項與 `refresh-exchange-rates`、`refresh-holidays`，共 4 項。
- `drive-maintenance` 的 helper 已改為函式目錄內依賴，commit `e5c6631` 已推送目前分支；focused helper tests 3/3 通過。
- 正式站 AI 摘要頁已可讀取 0 份摘要，Task 詳細資料可載入附件區與摘要建立表單，證明新增 schema 的基本讀取路徑可用。
- 本機 Executor 第二次交付已進入 Codex CLI，並將 `--sandbox` 與 `--approve-for-me` 互斥參數錯誤回寫到 Run。已在本機移除互斥組合並加入回歸測試；尚待重新交付驗證成功路徑。

## 尚未驗證／人工 blocker

- `RUN-20260923-0001` 已進入 Retrying。Codex success／Verification／Output 路徑仍待移除互斥 CLI 參數後重新交付驗證。
- Summary 建立與 Search 查詢、Drive 附件封存／維護的 production 寫入路徑尚未完成 smoke；Google Drive OAuth 權限是否仍有效也待實測。
- Google Drive 的既有版本文件可在指定「版本紀錄」子資料夾看到，但 Drive 畫面回報離線，無法開啟文件寫入本批交付紀錄；未將未完成同步描述為已完成。

## 下一個必要步驟

1. 推送本機 Executor 參數修正，重新啟動 bridge，再交付 Retrying Run，確認 Execution、Verification、Output 與 Run success 回寫。
2. 完成 Summary／Search／Drive 封存與維護的 production smoke；需要本人 Google OAuth 操作時記為 manual blocker。
3. Google Drive 恢復連線後，將本批 commits、Pages runs、production schema／functions 與 smoke 結果追加至既有版本文件並讀回核對。
