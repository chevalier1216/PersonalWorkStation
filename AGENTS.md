# PersonalWorkStation Repository Rules

## 規格與範圍

- 所有工作必須遵守 `docs/product/08-EXECUTION-RULES.md`。
- 只修改目前任務所需內容；不得改動任務範圍外已定案的產品決策、規格或行為。
- 若文件衝突，依 `docs/product/00-PRODUCT-OVERVIEW.md` 定義的文件權威順序處理。

## Repository 預設完成流程

Repo 修改完成後，除非使用者明確要求暫停，必須連續完成：

1. 執行與變更範圍相稱的必要驗證。
2. 安全且明確的一般錯誤自行修正並重跑驗證。
3. Commit 到目前工作分支。
4. Push 目前工作分支。
5. 回報分支、commit hash、驗證結果與 push 結果。

不得以只修改檔案、只通過本機檢查或只建立 commit 取代完整交付流程。若 push 被真正的 authentication 或 permission failure 阻擋，記錄為 manual blocker，保留已完成的 commit，並繼續不依賴該權限的工作。

## GitHub Authentication

- 日常 GitHub 操作固定使用既有 Codex GitHub Connector 或目前 repository environment。
- 禁止把 Browser Login、`gh auth login` 或 device verification 當成例行流程，也不得反覆要求使用者驗證。
- 一次正常操作確認為 authentication 或 permission failure 後，記錄原始錯誤與受阻操作，只要求使用者介入一次；在使用者確認狀態已改變前不得重試同一路徑。
- GitHub authentication blocker 不得阻塞其他可獨立完成的實作、驗證、文件或本機 commit。

## Google OAuth / Calendar

Google OAuth 或 Calendar 若需要使用者本人登入、同意授權或完成 Google UI 操作，必須記錄為 manual blocker，清楚說明待完成動作與受影響驗證。不得重複嘗試相同授權流程，也不得阻塞其他可獨立完成的工作。
