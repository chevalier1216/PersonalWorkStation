# M7 Status

## 已實作

- 主導覽完整對應：今日、任務看板、行事曆、AI 對話、AI 摘要、歷史紀錄、設定。
- 獨立行事曆頁面顯示 Task 與 Google events，支援同步、失敗重試、重新連結與 Calendar 選擇。
- AI 摘要索引列出所有版本、來源 Task 與建立時間，可開啟來源 Task 並定位摘要。
- Settings 提供既有容量、Drive archive metadata backup 與維護操作。
- Today、Task、Calendar、AI Chat、通知與主導覽均支援手機寬度。
- 增加鍵盤跳至主要內容連結，保留可見 focus 樣式與語意化區域標籤。
- 將 React、Supabase、互動元件與驗證套件拆成獨立 production chunks，避免單一主 bundle 超過 500 kB。
- GitHub Pages workflow 已準備，只在 `main` 或人工觸發時建置與發布。

## Cost Guardrail

- Repository 為 public；GitHub Pages 可使用 GitHub Free，未建立付費資源或升級方案。
- 未部署或呼叫 OpenAI API，未設定付費金鑰。
- M6 Google Drive 與 Supabase 操作仍維持既定免費額度邊界；接近門檻時由 Maintenance 提醒。

## Production 尚待完成

- 套用 M4-M6 production migrations、建立 private attachment bucket，並部署所需 Edge Functions。
- 啟用 Google Drive API，取得 `drive.file` OAuth 同意後完成 archive / failure / retry / maintenance smoke test。
- OpenAI API 真實 AI Chat / Summary 需使用者另行明確授權可能費用後才能部署與 smoke test。
- 設定 GitHub repository variables、Pages source、Supabase redirect allowlist，合併至 `main` 後發布。
- 正式 URL 完成 Login → Today → Task CRUD / Board → Calendar → Persistence / Refresh smoke test。

## 完成判定

本機驗證結果：

- TypeScript typecheck：通過（production build 內執行）。
- Vitest / PostgreSQL：10 files / 35 tests 通過。
- Playwright：desktop + mobile 36 / 36 通過。
- Production build：通過；主程式 chunk 約 274 kB，所有 chunk 均低於 500 kB。
- 第三方 Zod 套件仍有 Rollup 註解移除警告，不影響 build 結果。

production 項目在真實環境驗證前一律不得標示完成。
