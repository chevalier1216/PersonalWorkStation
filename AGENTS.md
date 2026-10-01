## Mandatory cross-project PR gate (2026-09-29)

本 repo **必須遵守** [跨專案 Git 交付政策](https://github.com/chevalier1216/KarpathyWiki_personal/blob/main/CROSS_PROJECT_GIT_POLICY.md)。此規範優先於本檔及其他舊文件中任何直接提交預設分支的做法；保留原有產品規格、必要測試、授權與成本限制。Work / Codex / 其他 Agent 不需使用者每次重複提醒：

- 從最新受保護整合分支建立 **每項獨立需求一個短期 branch**；禁止 direct commit/push 至整合分支，包括 Wiki、文件與 hotfix；多 Agent 使用獨立 branch/工作樹。
- 在工作分支驗證、commit、push，建立 PR；審核 diff、範圍、敏感資訊、必要 CI、衝突與 migration/部署影響。未過不得 merge；新費用、破壞性及授權操作仍需明確批准。
- 預設 Squash Merge 並留存 PR、head SHA、merge SHA、CI/部署讀回；需要回檔則從 revert branch 建 PR，不 force push/reset 整合分支。只開 PR 或只 push 不可說已完成整合。
- 並行功能用獨立 PR，合併前確認相依及更新最新整合分支；如不能建立 PR/執行驗證，記錄 blocker，**不可改走直接 push**。
- 此文件為工作方式，不代表 GitHub Ruleset 已啟用；須另行設定與讀回預設分支的 Require PR、必須 CI、禁止 force push/刪除。
- **當前過渡狀態：此 repo 的 GitHub default 是 `feat/v1-specs-m1`，暫視作受保護整合分支；尚無 main。須另案確認 CI/部署來源後再安全建立與切換 main，禁止直接推送現有 default。**


# PersonalWorkStation Repository Rules

## 規格與範圍

- 所有工作必須遵守 `docs/product/08-EXECUTION-RULES.md`。
- 只修改目前任務所需內容；不得改動任務範圍外已定案的產品決策、規格或行為。
- 產品規格一律由 `docs/product/00_PRD_INDEX.md` 進入，並以其列出的模組化 PRD 為 authoritative spec。
- `docs/product/08-EXECUTION-RULES.md` 是 repository 執行政策，不覆寫產品 PRD。

## 人類可讀語言與交付表述

- 所有對人可讀的修正說明預設使用繁體中文。
- GitHub Issue、PR 的標題與內文、PR／Issue 留言、修正摘要、驗證結果與交付說明，均應以繁體中文撰寫。
- 程式碼符號、命令、檔名、路徑、API／套件／產品官方名稱、精確錯誤訊息與引用的外部原文，可保留英文或其他語言原文；整體敘述、意義與解釋仍以繁體中文為主。
- 不得因 Codex、Agent、GitHub 或其他工具的預設語言，回退成全英文說明。
- 本規則從後續新建或更新的內容開始適用；既有 Issue／PR 若已使用英文，不需僅為符合本規則追溯改寫。

## Repository 預設完成流程

Repo 修改完成後，除非使用者明確要求暫停，必須連續完成：

1. 執行與變更範圍相稱的必要驗證。
2. 安全且明確的一般錯誤自行修正並重跑驗證。
3. Commit 到專屬短期分支。
4. Push 該工作分支並建立指向當前整合分支的 PR，審核差異及 CI 後 Squash Merge。
5. 回報分支、PR URL、head SHA、CI、merge SHA 與適用的部署讀回；未合併須標示 pending。

不得以只修改檔案、只通過本機檢查或只建立 commit 取代完整交付流程。若 push 被真正的 authentication 或 permission failure 阻擋，記錄為 manual blocker，保留已完成的 commit，並繼續不依賴該權限的工作。

## GitHub Authentication

- 日常 GitHub 操作固定使用既有 Codex GitHub Connector 或目前 repository environment。
- 禁止把 Browser Login、`gh auth login` 或 device verification 當成例行流程，也不得反覆要求使用者驗證。
- 一次正常操作確認為 authentication 或 permission failure 後，記錄原始錯誤與受阻操作，只要求使用者介入一次；在使用者確認狀態已改變前不得重試同一路徑。
- GitHub authentication blocker 不得阻塞其他可獨立完成的實作、驗證、文件或本機 commit。

## Google OAuth / Calendar

Google OAuth 或 Calendar 若需要使用者本人登入、同意授權或完成 Google UI 操作，必須記錄為 manual blocker，清楚說明待完成動作與受影響驗證。不得重複嘗試相同授權流程，也不得阻塞其他可獨立完成的工作。
