# Supabase Production Migration History 修復紀錄

日期：2026-09-29  
Project Ref：`wcvaazjhkczdgtudssdl`  
Production branch：`feat/v1-specs-m1`

## 問題與影響

Production 已有完整資料表、RLS、Policy、Function、Trigger 與附件 bucket，但 `supabase_migrations.schema_migrations` 沒有任何紀錄。Supabase GitHub Integration 因此把 repo 內 14 份既有 migration 全部判定為待執行；第一份 migration 嘗試再次建立 `allowed_users` 時即失敗。

若不補登 History，之後每次 Production deploy 都會重複發生同類失敗。資料庫功能目前可用，但部署管線無法可靠判定哪些 migration 已套用。

## 備份

修復前已用 PostgreSQL 17.6 官方工具建立並讀回驗證：

| 檔案                                  | 範圍                   | SHA-256                                                            |
| ------------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `production-public.custom`            | `public` schema 與資料 | `C5C7D5C47645CC5E3CC209B399AD3F3BD8588A0F805FDBB57C47A6B2DCA21948` |
| `production-public-schema.sql`        | `public` schema 純文字 | `4900760BE163EA1D5337210C16417899007500C8EBD0C6256C85D275E05F247D` |
| `production-migration-history.custom` | 現有 migration history | `D4700EE129A713707113C3DCA3740D05B58F953EFC327300155ED2DC71A27135` |

本機備份目錄：`G:\Projects\PersonalStation\backups\supabase-production-20260929-215758`。兩個 custom archive 均已通過 `pg_restore --list`，尚未執行還原。

## 唯讀比對結果

在本機 PostgreSQL 17.6 空資料庫依序套用 14 份 migration，再以相同 catalog query 讀取 Production。Production 查詢使用 read-only transaction 設定。

| 項目                                       | 預期 | Production | 結果  |
| ------------------------------------------ | ---: | ---------: | ----- |
| `public` tables（含欄位、constraint、RLS） |   28 |         28 | MATCH |
| Policies（含 3 個 Storage policies）       |   27 |         27 | MATCH |
| `public` functions                         |   27 |         27 | MATCH |
| `public` triggers                          |    3 |          3 | MATCH |
| `pws-attachments` private bucket           |    1 |          1 | MATCH |

`workspace_command_core_priority_reminders` 的 `pg_get_functiondef` 只有換行與欄位排列空白差異，SQL token 與字串內容一致。其餘項目逐字一致。`202609230002` 的資料修正條件也已核對：現有 1 筆 Today preference 合法，兩個 constraint 已驗證並包含全部允許模組。

## 已核對並補登為 Applied 的版本

以下版本的實際最終效果均已在 Production 找到，並已使用官方 `migration repair --status applied` 補登；沒有重新執行建表 SQL：

1. `202609190001` — Board 基礎 tables、RLS、policies、functions、triggers
2. `202609200001` — Task details 與 command
3. `202609200002` — Today、recurrence 與 notification
4. `202609200003` — M2 constraints
5. `202609200004` — Google Calendar
6. `202609210001` — Task details command restore
7. `202609210002` — AI Summary 與 search
8. `202609210003` — Attachments maintenance
9. `202609210004` — Private attachment Storage bucket 與 policies
10. `202609220001` — Workflow Execution Center
11. `202609220002` — Priority reminders
12. `202609230001` — Exchange rates
13. `202609230002` — Today module constraints 與資料 guard
14. `202609250001` — Archive claim

## GitHub Integration 現況

Supabase Dashboard 讀回結果：

- Repository：`chevalier1216/PersonalWorkStation`
- Working directory：`.`
- Deploy to production：啟用
- Production branch：`feat/v1-specs-m1`
- Automatic branching：停用；FREE 方案需升級 Pro 才可使用 preview branches

本次不升級方案、不啟用付費 Preview Branching。PR #5 顯示的 `Supabase Preview` 名稱來自 Supabase GitHub app 的部署檢查；實際失敗原因是 Production History 空白後重跑第一份 migration。

## 防止再發

- CI 執行 `npm run check:migrations`，檢查 migration version 唯一、檔案非空，且 PR 對既有 migrations 只能追加，不得修改、刪除或改名。
- Production repair 後，以 `supabase migration list --linked` 的輸出執行 `npm run check:migration-history -- <檔案>`；14 個 repo versions 必須全部出現在 remote 欄位。
- 每次正式部署前先執行 `migration list` 與 `db push --dry-run`。只要 History 缺版或出現 repo 未知 remote version，就停止部署並修復差異。
- Supabase GitHub Integration 成功套用新的 migration 後會寫入其 version；不得手動刪除 migration history，也不得改寫已套用 migration 檔。

## Production repair 結果

使用者於 2026-09-29 明確授權後，只對上述 14 個 version 執行官方 `supabase migration repair --status applied`。CLI 回報 `repairAll=false`，沒有重新執行 migration DDL。

repair 後讀回與驗證：

- `migration list --linked`：14 個 local／remote version 全部一對一相同。
- `npm run check:migration-history`：PASS，Production History 不缺版且沒有 repo 未知 remote version。
- `db push --dry-run --linked`：`upToDate=true`、`migrations=[]`、`Remote database is up to date.`。
- 稽核輸出保存於修復前備份目錄的 `audit/post-repair-migration-list.txt`。

這次寫入只補登 `supabase_migrations.schema_migrations`。下一步由 PR #7 的 Required Checks 與既有 Supabase GitHub Integration 驗證受保護 Production branch；驗證成功後才解除 PR #6 阻擋。
