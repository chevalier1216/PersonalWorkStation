# Calendar Site Tools 交付與正式驗收

更新：2026-09-30

## 本 PR 範圍

- 新增 WebMCP `calendar_create_event`，建立獨立 Google Calendar event，不建立 Task／Run。
- 將既有 Calendar 同步與 Task 關聯事件改由 authenticated `google-calendar` Edge Function 執行。
- 新增 server-side Google Access Token 續期、AES-GCM 加密憑證、`allowed_users` 綁定、一次 retry 與 `invalid_grant` 重連狀態。
- 新增 canonical fingerprint、private request state 及 Google private extended property 三層防重；成功後更新工作台 Calendar 快取。

## 部署前人工設定

本 PR 不自行變更 Production migration、Edge Function、Google OAuth Publishing Status 或公開部署。合併後由具權限者依序：

1. 套用 `202609300001_calendar_site_tools.sql`，部署 `google-calendar` Edge Function。
2. 在 Supabase Edge Function Secrets 設定：
   - `GOOGLE_TOKEN_ENCRYPTION_KEY`：32-byte 隨機值（建議 base64）。
   - `GOOGLE_OAUTH_CLIENT_ID`、`GOOGLE_OAUTH_CLIENT_SECRET`：與 Supabase Google provider 相同的 Web OAuth client。
3. 在 Google Auth Platform 讀回目前 Publishing Status。若仍為 External + Testing，記錄 refresh token 通常七日失效的限制；是否切換 In production、提交敏感 scope 驗證或任何可能產生費用的設定，另由使用者決定。
4. 以指定正式帳號在同一個 ChatGPT 內建瀏覽器明確執行一次「重新連結」，取得 offline refresh token。之後同瀏覽器有效 Session 恢復不應再次自動跳 consent。

Secrets 不得貼入 ChatGPT、PR、Git、URL、公開資料表或驗收截圖。

## 正式驗收清單

測試日期必須使用執行當下明確的未來時間，並記錄調整：

> 幫我在 Personal Workstation 的行事曆新增［未來日期］晚上 7:30 的「放行作業」，台灣時間；不建立 Task，也不要執行 Git。

- 地址列 Site Tools 清單可見 `calendar_create_event`，且網站存取／寫入確認由桌面客戶端顯示。
- 對話活動顯示真實工具呼叫成功，回傳 event ID、時間、時區與 Google Calendar link。
- Google Calendar 讀回同一 event；工作台同步與重新整理後仍可見；沒有新增 Task／Run。
- 用相同參數重試，回傳同一 event ID、`deduplicated=true`，Google Calendar 仍只有一筆。
- 未登入、未核准帳號、Guest Preview 及已撤銷 Google 授權均被拒絕。
- 同瀏覽器關閉重開可恢復；以過期 Access Token 驗證 refresh token 靜默續期。
- 撤銷 refresh token 或製造 `invalid_grant` 後，只提示一次重新連結，不進入 OAuth 迴圈；其他模組仍可用。
- 執行 `npm test`、`npm run test:e2e`、`npm run build`，並讀回 GitHub PR required checks。

若指定帳號、模型或 ChatGPT 桌面客戶端未提供 Site Tools，狀態是 platform/manual blocker；不得改用 Work、付費 OpenAI API、測試 harness 或 ChatGPT Google Calendar Connector 代替。

## PR 本機驗證

- `npm test`：60/60 通過，含 private credential boundary、allowlist 拒絕、request claim／complete 與 cache 讀回。
- `npm run test:e2e -- --config=.tmp/playwright-4174.config.ts`：desktop/mobile 48/48 通過；暫存 config 只為避開另一 checkout 占用的 `4173`，驗證後已刪除。
- `npm run build`、`npm run typecheck`、`npm run check:migrations`、`git diff --check`：通過。
- Edge Function 以 esbuild bundle 進行獨立語法檢查：通過。

以上是本機程式與結構證據，不代表 migration／Function 已部署、Google OAuth secrets 已設定、正式 event 已建立或 ChatGPT 桌面 Site Tools 已完成實機驗收。

## 官方依據

- OpenAI Site Tools：https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app
- WebMCP draft：https://webmachinelearning.github.io/webmcp/
- Supabase social provider tokens：https://supabase.com/docs/guides/auth/social-login
- Supabase Google offline access：https://supabase.com/docs/guides/auth/social-login/auth-google
- Google OAuth offline refresh：https://developers.google.com/identity/protocols/oauth2/web-server
- Google refresh token expiration：https://developers.google.com/identity/protocols/oauth2
