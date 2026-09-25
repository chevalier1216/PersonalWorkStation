# V1 授權與驗收：簡要交接

更新：2026-09-25。產品規格以 `docs/product/00_PRD_INDEX.md` 為準；技術證據見 `docs/V1-PRODUCTION-STATUS.md`。

## 瀏覽器審查與費用

Codex 自動操作[正式站](https://chevalier1216.github.io/PersonalWorkStation/)曾被審查以「額外網域操作」拒絕。現有訊息沒有指出是 Cost Guardrail，也沒有提供更細的拒絕原因；不能把它歸因於使用者的費用規則。正式站瀏覽本身不是啟用付費服務。審查狀態未改變前不重試或換工具繞過；需在正式站點擊的驗收由本人完成。

## 仍需本人驗收

- **工作台自動封存**：用小型附件實測封存與取回。帳號授權已確認，無需先重新連結；只有出現權限錯誤時，再由本人核對帳號並重新連結。不要提供密碼或驗證碼。

## 已完成

- **Issue #1／#2 正式站複驗：使用者於 2026-09-25 回報人工驗證通過**。範圍為指定帳號登入、Today 和任務看板載入，以及 Today 自訂版面移動、顯示「已儲存」、重新整理後順序保持並還原；此為使用者回報，不是 Codex 親自操作的證據。
- 已在指定[原始資料夾](https://drive.google.com/drive/folders/1GCgotx89aY6gRlt8mR7np9yDgE17FKYE)內建立並讀回 [Archive](https://drive.google.com/drive/folders/1KeuAJD5k2H_b1Co46kAdpaBWX8n2urLK)。使用者提供的 Google 帳號截圖顯示，`PersonalWorkStation` 已獲特定 Drive 檔案及 Calendar 的存取權。
- 歷史搜尋本機測試通過；Codex bridge 有一筆正式站唯讀 Run 成功，先前 Windows 啟動和 CLI 參數錯誤已修正。
- 產品程式 commit `a569438` 已推送工作分支，本機建置與相關桌面／手機測試 10/10 通過；正式站最後有明確部署證據的是 `3b09f2b`。

## 待驗證

- **Drive**：2026-09-25 使用者實測發現快速重複點擊可使附件顯示封存失敗、原件已移除；單次等待可完成封存。工作分支已修正重複請求並加入實際所在資料夾連結，尚待部署及正式站複驗。原有自動封存程式仍使用 `PersonalWorkStation/Attachments/YYYY/MM`，不是另建的 `Archive` 資料夾；取回、失敗重試與備份仍待完整驗收。
- **歷史搜尋與一般 Run**：正式站真實搜尋查詢未驗證；一般執行任務的 Artifact、Human Gate、Calendar／GitHub 關聯尚缺完整正式環境驗收。
- **假日同步與最新版**：每週假日同步已有程式與排程，尚無密鑰設定及成功排程的最新證據；新版尚未部署，遠端 CI 與最新版整體 smoke 未驗證。

## 已暫緩

- 工具內 ChatGPT 對話及從一般「對話」操作真實 Task 已依使用者決定暫存，相關入口在工作分支停用；Task／Run 建立與手動 Summary 保留。本項不再列入目前 V1 驗收。

## 建議順序

Issue #1／#2 人工複驗已完成；接著在正式站測歷史搜尋，並用小型附件測試 Drive 自動封存與取回；只有出現權限錯誤才重新連結。其後核對每週假日同步與一般 Run 的正式證據，最後部署最新分支並依 `07_ACCEPTANCE_AND_ROADMAP.md` 做整體 smoke。任何新付費服務仍須先依 `08-EXECUTION-RULES.md` 的 Cost Guardrail 告知並取得授權。
