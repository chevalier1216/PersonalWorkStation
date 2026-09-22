# Codex / Work Execution Rules

## Goal

交付真正可以日常使用的 PersonalWorkStation V1。

禁止把 UI Skeleton、Mock、Placeholder 當成完成。

## 工作方式

收到 Goal 後：

1. 先讀 `00_PRD_INDEX.md`
2. 讀目前工作對應的 authoritative module
3. 讀 `06_DATA_INTEGRATIONS_ARCHITECTURE.md`
4. 讀 `07_ACCEPTANCE_AND_ROADMAP.md`
5. 讀本文件
6. 檢查目前 repo 狀態
7. 建立最小可驗證實作計畫
8. 實作
9. 測試
10. Debug
11. 重跑驗證
12. 通過後再進下一工作

## V1 實作順序

1. 保留並回歸驗證既有 Task、Today、Calendar、搜尋、附件與封存能力。
2. 補齊新版提醒規則與首頁模組。
3. 建立 Workflow Run / Node / Event / Log / Artifact / Human Gate 資料模型。
4. 完成 Runs、Graph、Timeline、Detail 與 Today AI 執行狀態。
5. 完成 Task、Calendar、GitHub execution state 與 Run 的關聯。
6. 接上可驗證且符合 Cost Guardrail 的 executor bridge。
7. 完成正式部署與 `07_ACCEPTANCE_AND_ROADMAP.md` 全項 smoke test。

每一階段結束時都必須仍為可執行產品，且不得重做已由現況證據證明完成的功能。

## Terminal Verification

至少維持：

```bash
npm run dev
npm test
npm run test:e2e
npm run build
```

若最終實際 scripts 名稱不同，可調整，但需提供等價驗證。

## 自動連續執行

一般情況不得停下要求：

- GO
- 繼續
- 下一步

測試失敗：

自行查 root cause → 修正 → 重跑。

只有以下情況才詢問使用者：

- 產品決策
- Account authorization
- Permission blocker
- Destructive action
- 無法安全判斷的需求衝突

## Cost Guardrail（硬性執行規則）

任何可能新增費用的 API、雲端服務、付費資源、方案升級或自動化操作，在執行前必須停止並醒目告知使用者。

告知內容必須包含：

- 服務名稱
- 收費方式
- 免費額度
- 預估最低費用與可能費用

未經使用者明確授權，不得啟用、建立、升級、開啟計費或執行任何可能新增費用的服務、資源、方案或自動化。

確認仍在免費方案或免費額度內的操作可正常執行。接近、即將或可能超出免費額度時，必須在產生費用前停止並提前通知使用者。

### AI Execution V1 額度邊界

- V1 不得把額外付費 API 當成必要依賴。
- 未經使用者明確授權，不得建立 API key、購買 credits、升級方案或啟用按量計費 executor。
- Chat、Work、Codex、GitHub 或其他 executor bridge 必須先確認可用權限與費用邊界；接近既有免費或訂閱額度時依 Cost Guardrail 停止並通知使用者。
- Executor bridge 尚未接通時必須標示 manual blocker 或 Waiting External，不得以模擬回覆宣稱真實執行完成。

## GitHub Authentication Guardrail（硬性執行規則）

- GitHub 日常操作固定使用既有 Codex GitHub Connector 或目前 repository environment。
- 不得把 Browser Login、`gh auth login` 或 device verification 當成例行 GitHub 操作，也不得因 token 狀態不明而反覆啟動登入或要求驗證碼。
- 每項 GitHub 操作先依既有環境正常執行一次。只有操作回傳明確的 authentication 或 permission failure，才可判定需要使用者介入。
- 確認為 authentication 或 permission failure 後，必須保留原始錯誤、記錄受阻操作與需要使用者完成的最小動作，並只要求使用者介入一次。
- 在使用者確認 credential、權限或 connector 狀態已改變前，不得重試相同登入或驗證路徑，不得無限重試。
- GitHub authentication blocker 不得阻塞其他可獨立完成的實作、驗證、文件更新或本機 commit。

### Google OAuth / Calendar Manual Blocker

- Google OAuth 或 Calendar 若需要使用者本人登入、同意授權或操作 Google 頁面，必須記錄為 manual blocker。
- 紀錄必須包含待完成動作、受影響功能或驗證，以及已完成且可繼續的其他工作。
- 同一授權狀態未改變前不得重複嘗試，不得讓該 blocker 阻塞其他可獨立完成的工作。

## Default Repository Completion Rule（硬性執行規則）

任何 repo 修改完成後，除非使用者明確要求暫停或只產生未提交草稿，預設必須連續完成：

1. 執行與變更範圍相稱的必要驗證。
2. 對安全且明確的一般錯誤自行修正並重跑驗證。
3. Commit 到目前工作分支。
4. Push 目前工作分支。
5. 回報目前分支、commit hash、驗證結果與 push 結果。

不得以只修改檔案、只通過本機檢查或只建立 commit 取代完整交付流程。

若 push 遇到 GitHub Authentication Guardrail 定義的真正 authentication 或 permission failure，必須保留已完成的本機 commit、將 push 記錄為 manual blocker，並繼續所有不依賴該權限的工作。權限狀態未改變前不得反覆 push 或重新登入。

## 禁止事項

不得：

- 自行縮減 Requirement
- 自行新增 SaaS 架構
- 為未來功能大量預建抽象層
- 用 Mock 宣稱 Integration 完成
- 只測 localhost 就宣稱 Production 完成
- 因外部服務故障 rollback Task
- 未驗證就聲稱修復成功

## Evidence Before Completion

聲稱完成前必須實際執行相應驗證並確認結果。

正式 V1 完成至少需要：

```text
正式 Web
→ 登入
→ Today 正常
→ Task CRUD / Board 正常
→ Calendar 正常
→ AI Chat 建立或觸發 Task / Run
→ Run / Node / Graph / Timeline / Human Gate 正常
→ Task / Calendar / GitHub execution state 與 Run 關聯正常
→ Verification gate 正常
→ Persistence 正常
→ Refresh 正常
→ E2E 通過
→ Production smoke test 通過
```

## Goal 下發範例

實作 Calendar 與 Run 整合時，只需讀：

```text
00_PRD_INDEX.md
03_CALENDAR_REMINDERS.md
05_AI_EXECUTION_CENTER.md
06_DATA_INTEGRATIONS_ARCHITECTURE.md
07_ACCEPTANCE_AND_ROADMAP.md
08-EXECUTION-RULES.md
```

不應為一個 Calendar 任務把所有其他 module 全塞入 Context。

這是這組文件拆分的主要目的。
