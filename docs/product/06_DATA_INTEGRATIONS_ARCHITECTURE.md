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

使用者指定的人工／既有 Drive Connector 封存位置為 [Personal WorkStation Project / Archive](https://drive.google.com/drive/folders/1KeuAJD5k2H_b1Co46kAdpaBWX8n2urLK)，它是[原始專案資料夾](https://drive.google.com/drive/folders/1GCgotx89aY6gRlt8mR7np9yDgE17FKYE)的子資料夾。將原始資料夾中的檔案移入 `Archive` 即為此路徑的封存方式。

此資料夾由 Drive Connector 建立，不能據此推定 PersonalWorkStation 的 Google OAuth `drive.file` 已取得對該資料夾的存取權。現有工作台 `drive-archive` 函式仍使用其既有的 `PersonalWorkStation/Attachments/YYYY/MM` 路徑；在完成 OAuth 與實際讀寫驗證前，不得宣稱工作台自動封存已改用上述資料夾。

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

### Calendar OAuth 與 Site Tools 資料流

- Supabase Session 的 `persistSession`／`autoRefreshToken` 只維持工作台登入，不視為 Google provider token 已續期。
- 初次連結或明確重新連結以 `access_type=offline` 及 `prompt=consent` 取得 Google refresh token；有效 Session 恢復時先使用伺服器端既有憑證，不在每次開站強制同意。
- Browser 在 OAuth callback 取得 provider token 後，只送至 authenticated `google-calendar` Edge Function。Refresh Token 與 Access Token 以 `GOOGLE_TOKEN_ENCRYPTION_KEY` 做 AES-GCM 加密，僅由 service-role RPC 寫入 `private` schema；前端、URL、模型上下文、Git 與公開資料表均不保存明文。
- Edge Function 以目前 Supabase user 及 `allowed_users` 綁定憑證。Google Access Token 到期時最多續期一次；`invalid_grant` 與重新取得 Access Token 後仍為 401 才標記需重新連結，不進入 OAuth 迴圈。
- `calendar_create_event` 由 Edge Function 寫入 Google Calendar，使用 canonical request fingerprint、private request state 與 Google private extended property 防止重試重複。成功後才更新 `google_calendar_events` 與 `google_calendar_sync_state`。
- Supabase Edge secrets 必須包含 `GOOGLE_TOKEN_ENCRYPTION_KEY`、`GOOGLE_OAUTH_CLIENT_ID`、`GOOGLE_OAUTH_CLIENT_SECRET`。這些值不得交給 ChatGPT 或寫入 repository。
- Google OAuth 若為 External + Testing，refresh token 的七日期限及切換 In production／敏感 scope 驗證屬 Google Console 人工設定；不得由程式自行變更或承諾永久免授權。

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

## 9. 本機 Executor bridge

- 只監聽 `127.0.0.1`，不公開對外網路。
- 使用已登入的 Codex CLI 與既有訂閱額度，不使用 OpenAI API key。
- 使用瀏覽器短效 Supabase access token 回寫該使用者自己的 Run，不使用 service role key。
- Repository root 由本機設定固定，不接受網頁傳入任意路徑。
- 只有 Verification 有明確通過證據時才能完成 Run；必要人工操作寫入 Human Gate。

## 10. 玉山外幣匯率

- Edge Function 只讀取指定的玉山銀行官方頁面。
- Supabase 保存 USD、CNY、JPY、EUR、AUD 最後成功的即期與現金買入／賣出報價。
- 失敗只更新錯誤狀態，不清除最後成功資料，也不影響其他工作台模組。
