# Data, Integrations & Architecture

版本：`ver.26.09.22.1516`

## 1. 主資料

Supabase 作為主要工作台資料儲存。

主要資料類型：

- Tasks
- Calendar links
- Notes
- Workflow Runs
- Workflow Nodes
- Workflow Events
- Workflow Logs
- Workflow Artifacts
- Human Gates

## 2. Workflow 資料表

建議：

- `workflow_runs`
- `workflow_nodes`
- `workflow_events`
- `workflow_logs`
- `workflow_artifacts`
- `workflow_human_gates`

## 3. Google Drive 封存

Google Drive 作為長期大檔與大型 Log 封存。

Supabase 容量達 70% 且沒有擴充方案時需提醒。

大型附件 / Raw Log 可由 AI Agent 搬移至 Drive，只在主資料庫保留索引與摘要。

## 4. GitHub

GitHub Repository / Issue / PR / Commit 作為開發類工作的 canonical execution state。

Workflow Node 可關聯：

- Repository
- Issue
- Branch
- Commit
- PR
- Test Result

## 5. Google

整合：

- Google OAuth
- Google Calendar
- Google Drive

未來保留飛書登入擴充可能。

## 6. Secret / Security

若前端部署在 GitHub Pages：

禁止在 browser 放入：

- GitHub Token
- Google OAuth Secret
- API Secret
- Supabase Service Role Key

敏感操作需透過：

- Supabase backend / Edge Function
- GitHub Workflow / Runner
- 授權服務

## 7. 外部服務故障

單一整合失敗不得拖垮整個工作台。

外部服務 Node 可進入：

- Waiting External
- Retrying
- Paused
- Failed

其餘模組仍可正常使用。

## 8. Log 策略

分層保存：

### Summary

長期保留。

### Execution Log

保存必要執行紀錄。

### Large Raw Log

移往 Google Drive。

禁止無限制把 stdout / verbose log 灌入 Supabase。
