# V1 Production Status

更新日期：2026-09-23

## 已驗證

- 本批功能 commit `fb759f2` 已推送至 `origin/feat/v1-specs-m1`。
- TypeScript、43 項 unit / database tests、38 項 desktop / mobile Playwright tests、production build 通過。
- 本機 Executor bridge 可啟動，`http://127.0.0.1:4317/health` 回傳 `ok: true`；未在此批驗證中消耗 Codex 額度執行真實 Run。
- Supabase production 已套用 `202609230001_exchange_rates.sql`。
- Supabase production 已部署 `refresh-exchange-rates`。
- Dashboard production smoke 回傳 HTTP 200：`{"ok":true,"count":5}`。
- GitHub repository variables `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY` 已設定於 repository scope；未使用 `service_role`。
- GitHub Pages 已由 workflow run `35826502465` 成功建置與部署 commit `995e5c7`：<https://chevalier1216.github.io/PersonalWorkStation/>。
- Supabase Auth Site URL 與 redirect allowlist 已設定為正式 Pages URL。
- 正式站已完成 Google 登入，Today、既有 Task、Calendar、通知與 AI Execution 模組均可載入。
- 正式站匯率模組顯示玉山官方 USD、RMB/CNY、JPY、EUR、AUD 的即期與現金買入／賣出及更新時間。
- GitHub issue #2 的 runtime variables / Pages deployment 問題已修復；workflow 的 configuration check、build、artifact upload 與 deploy 均成功。
- GitHub issue #1 已新增 `202609230002_today_preferences_module_guard.sql` 並套用 production。正式站將玉山匯率模組上移、顯示「已儲存」、重新整理後保持順序，再還原原版面，確認 constraint 不再阻擋目前 V1 module keys。

## 尚未驗證

- 真實本機 Codex Run 的端到端 production smoke 尚未執行；目前證據只涵蓋 bridge 啟動、health、輸入驗證、UI 與 workflow 自動測試。

## 下一個必要步驟

1. 在使用者願意消耗 Codex 訂閱額度時，啟動 `npm run executor:local`，建立一個低風險 Run，確認 Node、Log、Verification、Artifact 或 Human Gate 能回寫原 Run。
2. GitHub issues #1、#2 的修正已具備 production 證據；待可用 GitHub authentication 環境恢復後再更新 issue 狀態，不重複要求 browser/device login。
