# GitHub Issue → Codex Worker

版本：`ver.26.09.30.8`
狀態：功能 branch 實作；真實 GitHub E2E 與排程啟用狀態以本文件「驗證紀錄」為準。

## 用途與邊界

這套本機 Worker 將 `chevalier1216/PersonalWorkStation` 的 GitHub Issue 交給已登入的 Codex CLI：

```text
Open Issue + codex:ready
→ Windows Scheduled Task（每 5 分鐘）
→ 本機 Worker claim
→ Codex branch / 實作 / 測試 / commit / push / PR
→ Issue 留言與 codex:done
```

它只處理開發／維護 Issue，不監聽工作台 Task、Calendar event 或 Issue 內文關鍵字。GitHub Issue、branch、commit、PR 與 CI 是 canonical execution state；本機 `run.json` 只用於 lock／crash recovery，不是第二套任務佇列。

V1 不公開 Port、不新增 VPS、Queue、SaaS 或付費 API，也不使用 OpenAI API key。Codex 使用本機既有訂閱登入；GitHub 使用既有 `gh` 認證。

## 狀態 Label

- `codex:ready`：可由 Worker claim。
- `codex:running`：Worker 已取得執行權。
- `codex:blocked`：需要 Human Gate；不會自動無限重試。
- `codex:done`：已建立且回寫可追蹤交付結果；不代表 PR 已 merge。

Worker 只會選擇 Open、具有 `codex:ready`，且沒有其餘三個狀態 label 的 Issue。完成 Human Gate 後，移除 `codex:blocked` 並重新加入 `codex:ready`；Worker 會沿用原 branch／PR。

## 安全設計

- 程式白名單目前只允許 `chevalier1216/PersonalWorkStation`，本機路徑由安裝時設定，Issue 不能指定 filesystem path。
- 所有 `gh`、`git`、`codex` 呼叫使用 argument array 且 `shell: false`；Issue 文字只經 stdin 進入 Codex prompt，不會直接執行。
- Prompt 以 `<untrusted_issue_body>` 隔離 Issue，並先要求讀取 `AGENTS.md`、PRD index 與 execution rules。
- 可信 Worker prompt 明確承接使用者對 label／留言、branch、commit、push 與建立或更新唯一 PR 的既有授權；Codex 不會為這些流程內動作重複要求 Human Gate。merge 始終不在授權範圍。
- 每個 repository 使用獨占 lock；排程重入會直接跳過。stale lock 會保留副本並依 `run.json`、Issue、branch、PR 狀態恢復。
- 同一 Issue branch 固定為 `codex/issue-<number>-<slug>`；偵測到既有 PR 時會更新／驗證既有工作，不建立第二個 PR。
- 普通工程錯誤最多執行兩次有界修復；登入、權限、OAuth、Secret、費用、破壞性操作或真正規格衝突改為 `codex:blocked`。
- GitHub authentication failure 會開啟本機 circuit；後續排程不再反覆登入。恢復既有認證後執行 `--doctor`，驗證成功才解除 circuit。
- console 與排程 log 會遮蔽常見 token／secret 格式，且不保存 Codex stdout。
- Windows PowerShell runner 明確以 UTF-8 解碼 Node 輸出，繁中狀態可直接閱讀。

## 前置條件

1. Windows Remote 已安裝 Node.js 24、Git、GitHub CLI 與 Codex CLI。
2. `gh auth status --hostname github.com` 成功，且帳號可管理 Issue、Label、branch 與 PR。
3. `codex --version` 成功，Codex CLI 已使用現有訂閱登入。
4. Repository checkout 乾淨；既有未提交工作會觸發 `codex:blocked`，不會被覆寫。

不得以 `gh auth login` 當例行步驟。只有 `--doctor` 回報真實 authentication failure 時，才由使用者恢復既有 GitHub 認證一次。

## 安裝

在 repository root 執行：

```powershell
pwsh -NoProfile -File .\scripts\Install-CodexIssueWorkerTask.ps1
```

Scheduled Task action 使用 Windows 內建 `wscript.exe` 執行 runtime 內的 `Run-CodexIssueWorkerHidden.vbs`，再以 hidden window style 啟動既有 PowerShell runner。Task Scheduler 不再直接啟動 `powershell.exe`，因此不會先建立可見 console 再隱藏；launcher 仍會同步等待 runner，並把原 exit code 回傳給 Task Scheduler。

舊版已安裝的 Task 不會自動改寫 action。合併新版後，需在 repository root 重新執行上方同一條安裝指令，才會把 launcher 複製到 `%LOCALAPPDATA%\PersonalWorkStation\codex-issue-worker\runtime` 並重新註冊 Task。

安裝器會：

1. 驗證白名單 repository 與必要 instructions。
2. 將具體 mapping 寫入 `%LOCALAPPDATA%\PersonalWorkStation\codex-issue-worker\config.json`。
3. 將 Worker runtime 複製到 `%LOCALAPPDATA%\PersonalWorkStation\codex-issue-worker\runtime`，避免 repository 切換到 Issue branch 後遺失排程入口。
4. 將安裝時已驗證的 Node、Git、GitHub CLI 與 Codex CLI 目錄固定加入 Scheduled Task 的 runtime PATH，避免排程環境與互動式終端 PATH 不同。
5. 建立或更新四個 GitHub labels。
6. 建立登入觸發與每 5 分鐘觸發的 Scheduled Task。
7. 設為 `IgnoreNew`，避免前一輪尚未完成時平行啟動。

預檢但不註冊：

```powershell
pwsh -NoProfile -File .\scripts\Install-CodexIssueWorkerTask.ps1 -WhatIf
node .\scripts\github-issue-worker.mjs --config "$env:LOCALAPPDATA\PersonalWorkStation\codex-issue-worker\config.json" --doctor
```

`-WhatIf` 不會建立 config，因此第一次 doctor 應在正式安裝寫入 config 後執行。若 labels 已存在，可用 `-SkipGitHubSetup` 重建本機 task。

更新安裝時若既有 Scheduled Task 正在執行，安裝器會中止更新並要求稍後重試，不會覆寫使用中的 runtime 或中斷正在處理的 Issue。

## 操作

建立具體、可執行且不含 Secret 的 Issue，確認需求已決定後加入 `codex:ready`。Worker 每輪只處理最小 Issue number 的一件工作。

手動安全觸發單輪：

```powershell
pwsh -NoProfile -File .\scripts\Run-CodexIssueWorker.ps1 `
  -ConfigPath "$env:LOCALAPPDATA\PersonalWorkStation\codex-issue-worker\config.json"
```

檢查狀態：

```powershell
Get-ScheduledTask -TaskName 'PersonalWorkStation Codex Issue Worker'
Get-ScheduledTaskInfo -TaskName 'PersonalWorkStation Codex Issue Worker'
Get-Content "$env:LOCALAPPDATA\PersonalWorkStation\codex-issue-worker\logs\worker-$(Get-Date -Format yyyy-MM-dd).log" -Tail 100
```

## Recovery

- Remote 關機：尚未 claim 的 Issue 保留 `codex:ready`；開機／登入後再掃描。
- Worker crash：下一輪讀取 stale lock、`run.json`、Issue 與既有 PR，延續相同 branch；若是 Human Gate 後重新加入 `codex:ready`，會先重新 claim 為 `codex:running` 再續跑。
- 已有 PR：恢復該 PR，禁止建立重複 branch／PR。
- GitHub／Codex authentication failure：移除 `codex:running`、加入 `codex:blocked`，Issue 只留言最小人工動作。
- 若 GitHub 已完全無法寫入，Worker 無法安全更新 Issue，會先開啟本機 authentication circuit；恢復既有認證並通過 `--doctor` 後再續跑原狀態。
- 有界重試仍失敗：保留 branch 與成果，進入 `codex:blocked`。

## 移除

只移除排程並保留 recovery 狀態：

```powershell
pwsh -NoProfile -File .\scripts\Uninstall-CodexIssueWorkerTask.ps1
```

確認不再需要 recovery 後，才加 `-RemoveLocalState` 移除本機 config、state 與 30 日內 log。此操作不會刪除 GitHub Issue、branch 或 PR。

## 驗證紀錄

本機自動測試覆蓋：精確 label trigger、狀態互斥、單 Issue 選取、branch 正規化、repository 白名單、不可信 prompt 邊界、credential 遮蔽、排程 lock／stale recovery、Human Gate 分類。

真實 GitHub E2E 必須另行記錄下列證據，未全部完成前不得宣稱自動交接已完成：

- 測試 Issue number／URL。
- `codex:ready → codex:running → codex:done` 留言與時間。
- branch、commit SHA、PR URL、實際測試及 CI。
- Worker 第二次掃描未建立重複 branch／PR。
- blocker 測試 Issue 進入 `codex:blocked` 且沒有無限重試。
- Scheduled Task 名稱、最後執行結果與五分鐘重複設定。
- 沒有 OpenAI API key、新付費服務或公開 Port。

### 2026-09-30 實際驗證結果

實作 branch 為 `feat/github-issue-codex-worker`，獨立交付為 PR [#8](https://github.com/chevalier1216/PersonalWorkStation/pull/8)；主要 runtime 修正涵蓋至 commit `66a2b04`。未 merge。

Happy path：

- Issue [#9](https://github.com/chevalier1216/PersonalWorkStation/issues/9) 實際完成 `codex:ready → codex:running → codex:done`，保留開始、blocker recovery 與完成留言。
- 固定 branch：`codex/issue-9-e2e-github-issue-codex-worker-happy-path`。
- commit：`2dad385d33578e248f40532b6f21ec191e704adc`。
- 獨立 PR [#10](https://github.com/chevalier1216/PersonalWorkStation/pull/10)，base 為 `feat/v1-specs-m1`，維持 Open、未 merge。
- PR #10 的兩個 `V1 verification / verify` run 均通過；內容只新增驗證文件，未修改產品程式、正式資料、資料庫或部署設定。
- 完成後第二次掃描回報 `idle`，相同 head branch 仍只有 PR #10，沒有重複 branch／PR。
- 第一次執行曾把已授權的 PR 建立誤判為 Human Gate；修正可信 prompt 後由同一 Issue、branch、commit recovery 完成，並加入 regression test。

Blocker path：

- Issue [#12](https://github.com/chevalier1216/PersonalWorkStation/issues/12) 使用可移除的未追蹤 sentinel 模擬 dirty worktree。
- Worker 先 claim 為 `codex:running`，隨後保護既有工作並轉為 `codex:blocked`；未清除檔案、未執行 Codex、未 push、未建立 PR。
- blocker 後第二次掃描回報 `idle`，Issue 留言數維持 `2 → 2`，證明沒有無限重試；sentinel 已移除。

本機與排程：

- 最終 focused Worker tests：`10/10`；全套 `npm test`：`13` 個檔案、`59/59` tests 通過。
- `npm run typecheck`、`npm run build`、三個 PowerShell script parser 皆通過；產品 UI 未因最終 Worker-only 修正重跑 E2E，先前隔離 commit 的 desktop/mobile E2E 為 `46/46` 通過。
- Task：`PersonalWorkStation Codex Issue Worker`；runtime 位於 `%LOCALAPPDATA%\PersonalWorkStation\codex-issue-worker\runtime`；專用 checkout 為 `G:\Projects\PersonalStation\PersonalWorkStation-worker-run`。
- Task 設定為登入觸發、`PT5M` 重複、`IgnoreNew`。2026-09-30 21:23（Asia/Taipei）實際啟動後回到 `Ready`，`LastTaskResult = 0`、`NumberOfMissedRuns = 0`，UTF-8 log 明確記錄 `idle`。
- 未使用 OpenAI API key、未新增付費 API／服務、未開公開 Port，也未執行 production deploy。

GitHub CLI 認證診斷：

- 實際 Windows 使用者環境的 `gh auth status`、`gh api user` 與 `gh pr view` 均成功；帳號 `chevalier1216` 使用 Windows keyring。
- 沒有 process／user／machine 層級的 `GH_TOKEN` 或 `GITHUB_TOKEN` 覆寫，Windows Vault service 正常。
- 先前的 401／無憑證結果只發生在無法讀取 Windows Credential Manager 的 Codex sandbox；同一時間在實際使用者環境驗證成功。這是環境隔離造成的假陰性，不是 `gh` 憑證持續失效。
- Worker、installer 與 Scheduled Task 的 GitHub 操作必須在實際使用者／Task Scheduler context 執行；不得因 sandbox 診斷失敗而例行重跑 `gh auth login`。
