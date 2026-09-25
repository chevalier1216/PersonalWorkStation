# V1 授權與驗收：簡要交接

更新：2026-09-25。產品規格以 `docs/product/00_PRD_INDEX.md` 為準；技術證據見 `docs/V1-PRODUCTION-STATUS.md`。

## 瀏覽器審查與費用

Codex 自動操作[正式站](https://chevalier1216.github.io/PersonalWorkStation/)曾被審查以「額外網域操作」拒絕。現有訊息沒有指出是 Cost Guardrail，也沒有提供更細的拒絕原因；不能把它歸因於使用者的費用規則。正式站瀏覽本身不是啟用付費服務。審查狀態未改變前不重試或換工具繞過；需在正式站點擊的驗收由本人完成。

## 需要本人做的事

1. **正式站複驗 Issue #1／#2**：以指定帳號登入，確認 Today 和任務看板載入；在 Today「自訂版面」移動一個模組，看到「已儲存」後重新整理，確認順序保持，再還原。兩張 issue 已修復、關閉且有先前正式環境證據；這一步補最新畫面證據，不需 Work 額度。
2. **需要工作台自動封存時**：先在 [Google 帳號第三方連線](https://myaccount.google.com/connections)查看 `Project WorkStation` 的 Calendar／Drive 權限。若不足，在工作台按「重新連結 Google Drive」，核對帳號與權限並由本人同意。不要提供密碼或驗證碼。Google Cloud Data Access 的六項 scope 尚未儲存；帳號實際授予的 scope 也尚未讀回，不能宣稱 Drive 授權已完成。

## 已完成與仍未通過

- 已在指定[原始資料夾](https://drive.google.com/drive/folders/1GCgotx89aY6gRlt8mR7np9yDgE17FKYE)內建立並讀回 [Archive](https://drive.google.com/drive/folders/1KeuAJD5k2H_b1Co46kAdpaBWX8n2urLK)。人工封存可直接將檔案移入；本次未移動未指定的檔案。工作台原有自動封存程式仍使用另一條路徑，且 `drive.file` 未證實可存取此資料夾，因此自動封存、重新開啟、失敗重試與備份尚未通過正式環境驗收。
- 歷史搜尋已有本機測試，正式站真實查詢未驗證；尚無目前功能失敗的證據。
- 本機 Codex bridge 已有一筆正式站**唯讀 Run** 成功；一般執行任務的 Artifact、Human Gate、Calendar／GitHub 關聯尚缺完整正式環境驗收。早期 Windows 啟動和 CLI 參數錯誤已修正，不能當作目前仍失敗。
- 每週假日同步有程式與排程；尚無密鑰設定及成功排程的最新證據，狀態為未驗證。
- 最新產品程式 commit `a569438` 已推送工作分支，本機建置與相關桌面／手機測試 10/10 通過；正式站最後有明確部署證據的是 `3b09f2b`。新版尚未部署，遠端 CI 與最新版整體 smoke 未驗證。
- 工具內 ChatGPT 對話及從一般「對話」操作真實 Task 已依使用者決定暫存，相關入口在工作分支停用；Task／Run 建立與手動 Summary 保留。本項不再列入目前 V1 驗收。

## 建議順序

先用一次正式站登入完成 Issue #1／#2 與歷史搜尋複驗；需要自動 Drive 封存時，再處理本人 OAuth 並用小型附件測試。其後核對每週假日同步與一般 Run 的正式證據，最後部署最新分支並依 `07_ACCEPTANCE_AND_ROADMAP.md` 做整體 smoke。任何新付費服務仍須先依 `08-EXECUTION-RULES.md` 的 Cost Guardrail 告知並取得授權。
