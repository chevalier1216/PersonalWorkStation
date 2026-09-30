# GitHub Issue → Codex Worker

版本：`ver.26.09.30.3`
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

安裝器會：

1. 驗證白名單 repository 與必要 instructions。
2. 將具體 mapping 寫入 `%LOCALAPPDATA%\PersonalWorkStation\codex-issue-worker\config.json`。
3. 將 Worker runtime 複製到 `%LOCALAPPDATA%\PersonalWorkStation\codex-issue-worker\runtime`，避免 repository 切換到 Issue branch 後遺失排程入口。
4. 建立或更新四個 GitHub labels。
5. 建立登入觸發與每 5 分鐘觸發的 Scheduled Task。
6. 設為 `IgnoreNew`，避免前一輪尚未完成時平行啟動。

預檢但不註冊：

```powershell
pwsh -NoProfile -File .\scripts\Install-CodexIssueWorkerTask.ps1 -WhatIf
node .\scripts\github-issue-worker.mjs --config "$env:LOCALAPPDATA\PersonalWorkStation\codex-issue-worker\config.json" --doctor
```

`-WhatIf` 不會建立 config，因此第一次 doctor 應在正式安裝寫入 config 後執行。若 labels 已存在，可用 `-SkipGitHubSetup` 重建本機 task。

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
- Worker crash：下一輪讀取 stale lock、`run.json`、Issue 與既有 PR，延續相同 branch。
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
