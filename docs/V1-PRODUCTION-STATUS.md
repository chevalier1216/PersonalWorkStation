# V1 Production Status

更新日期：2026-09-23

## 已驗證

- 本批功能 commit `fb759f2` 已推送至 `origin/feat/v1-specs-m1`。
- TypeScript、43 項 unit / database tests、38 項 desktop / mobile Playwright tests、production build 通過。
- 本機 Executor bridge 可啟動，`http://127.0.0.1:4317/health` 回傳 `ok: true`；未在此批驗證中消耗 Codex 額度執行真實 Run。
- Supabase production 已套用 `202609230001_exchange_rates.sql`。
- Supabase production 已部署 `refresh-exchange-rates`。
- Dashboard production smoke 回傳 HTTP 200：`{"ok":true,"count":5}`。

## 尚未發布／驗證

- 新版 GitHub Pages 前端尚未發布。
- 真實本機 Codex Run 的端到端 production smoke 尚未執行；目前證據只涵蓋 bridge 啟動、health、輸入驗證、UI 與 workflow 自動測試。

## 下一個必要步驟

1. 以已授權的 production workflow 發布 Pages。
2. 於正式站登入，確認匯率模組顯示五幣別與來源時間。
3. 啟動 `npm run executor:local`，建立一個低風險 Run，確認 Node、Log、Verification、Artifact 或 Human Gate 能回寫原 Run。
