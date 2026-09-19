# Codex / Work Execution Rules

## Goal

交付真正可以日常使用的 PersonalWorkStation V1。

禁止把 UI Skeleton、Mock、Placeholder 當成完成。

## 工作方式

收到 Goal 後：

1. 先讀 `00-PRODUCT-OVERVIEW.md`
2. 讀該 Milestone 對應 Domain spec
3. 讀 `06-TECHNICAL-ARCHITECTURE.md`
4. 讀 `07-ACCEPTANCE-TESTS.md`
5. 讀本文件
6. 檢查目前 repo 狀態
7. 建立最小可驗證實作計畫
8. 實作
9. 測試
10. Debug
11. 重跑驗證
12. 通過後再進下一工作

## Milestone 建議順序

### M1
Task + Board + Persistence

### M2
Today + Notification + Recurring

### M3
Google Calendar

### M4
AI Chat + AI Task Actions

### M5
AI Summary + History Search

### M6
Attachments + Drive Archive + Maintenance

### M7
Responsive + UI Polish + Production Hardening

每個 Milestone 結束時都必須仍為可執行產品。

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
→ AI Chat 正常
→ Persistence 正常
→ Refresh 正常
→ E2E 通過
→ Production smoke test 通過
```

## Goal 下發範例

實作 Calendar Milestone 時，只需讀：

```text
00-PRODUCT-OVERVIEW.md
02-CALENDAR.md
06-TECHNICAL-ARCHITECTURE.md
07-ACCEPTANCE-TESTS.md
08-EXECUTION-RULES.md
```

不應為一個 Calendar 任務把所有其他 Domain spec 全塞入 Context。

這是這組文件拆分的主要目的。
