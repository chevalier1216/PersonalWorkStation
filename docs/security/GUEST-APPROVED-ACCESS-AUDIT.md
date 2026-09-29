# Guest Preview + Approved User Access Security Audit

日期：2026-09-29

## 信任邊界

| 路徑            | 身分                                      | 資料來源               | 寫入位置                    |
| --------------- | ----------------------------------------- | ---------------------- | --------------------------- |
| Guest Preview   | 未登入                                    | 內建展示資料           | 目前分頁的 `sessionStorage` |
| Approved User   | Supabase Google session + `allowed_users` | 該 `auth.uid()` 的資料 | 該 `auth.uid()` 的資料      |
| Calendar／Drive | 目前使用者的 Google OAuth token           | 目前 Google 帳號       | 目前 Google 帳號            |
| 參考資料同步    | Scheduler secret／service role            | 公開假日與匯率來源     | 共用唯讀參考資料            |

## 稽核結果

- **PASS — 核准**：沿用 `public.allowed_users` 與 `public.is_allowed()`；未新增第二套名單。
- **PASS — 私人資料表**：Task、細節、通知、Calendar 快取、Summary、附件索引與 Workflow tables 均使用 `owner_id`，RLS select policy 同時檢查 `auth.uid()` 與 `is_allowed()`；寫入只經同樣檢查的 RPC。
- **PASS — Storage**：`pws-attachments` 是 private bucket；insert/select/delete policy 都要求第一層路徑等於 `auth.uid()` 且帳號仍獲核准。
- **PASS — Drive Edge Functions**：`drive-archive` 與 `drive-maintenance` 使用呼叫者 JWT 建立 Supabase client、用 `auth.getUser()` 驗證，並只接收該次請求傳入的 Google token；不使用 service role。
- **PASS — 共用 Edge Functions**：假日與匯率函式只寫共用參考資料，不接收 Google token、不讀取使用者 Task／Calendar／Drive 資料。假日同步另有 scheduler secret。
- **PASS — Guest**：Guest operations 模組沒有引用 Supabase client；E2E 監測私人 REST／Storage／Functions 路徑為零請求。
- **PASS — 撤銷**：刪除 `allowed_users` 後，RPC 的 `is_allowed()` 與 RLS 立即拒絕既有 session。

## 驗證範圍與部署邊界

- 本 PR 的 SQL migration 差異為零；不修改 production schema 或 migration history。
- 本地 PGlite 驗證未核准、核准後資料隔離、跨帳號寫入阻擋與撤銷。
- Google OAuth consent 與 production 帳號實測需在 Migration History 修復驗證成功後進行；在此之前 PR 保持 Open，禁止 merge 與 production deploy。
