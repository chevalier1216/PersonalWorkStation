# AI Execution Center / Workflow Monitor

版本：`ver.26.09.22.1516`

## 1. 定位

AI Execution Center 是 AI 個人工作台的核心模組，不是獨立工具。

用途：

> 將 Chat、Work、Codex、GitHub、測試、Wiki、Google 等執行過程統一轉成可視化、可追蹤、可驗證的狀態。

V1 採 **Read-only Observable Workflow**。

不做自由拖拉編排。

---

## 2. Run

任何可追蹤 AI 任務建立唯一 Run。

範例：

`RUN-20260922-0001`

Run 至少保存：

- Run ID
- Title
- Source
- Related Task
- Project
- Status
- Started At
- Finished At
- Duration
- Current Node
- Executor
- Retry Count
- Error
- Human Required
- Output

Run 歷史不可因完成而刪除。

---

## 3. Run Status

統一狀態：

- Queued
- Running
- Waiting External
- Waiting Human
- Retrying
- Paused
- Failed
- Success
- Cancelled

不得只用「執行中 / 完成」。

---

## 4. Node

Run 由多個 Node 組成，例如：

Trigger → Context → Execution → Verification → Output

Node 至少保存：

- Node ID
- Run ID
- Name
- Type
- Status
- Started At
- Finished At
- Input
- Output
- Error
- Retry Count
- Tool
- Verification
- Parent Node

Node Type：

- AI
- Tool
- Test
- Human
- System

---

## 5. Graph View

主要視覺參考 ComfyUI 的節點與連線方式，但用途是「觀察執行」，不是建立模型流程。

節點狀態需可視化：

- ✓ Success
- ● Running
- ○ Queued
- ↻ Retrying
- ‖ Paused
- ! Waiting Human
- × Failed

點擊 Node 顯示：

- Input
- Output
- Tool
- Log
- Error
- Retry
- Verification
- Artifact
- Related Task

---

## 6. Timeline

每個 Run 提供事件時間線，例如：

- Run created
- Spec loaded
- Tool started
- Test failed
- Retry #1
- Test passed
- Push completed
- Run success

Timeline 只保留有決策價值的事件，不堆疊無意義 debug 噪音。

---

## 7. Human Gate

只有以下狀況可進入 Waiting Human：

- 產品決策缺少既有規格
- OAuth / 登入
- 權限不足
- 破壞性 / 不可逆操作
- 必須由使用者在互斥方案中決策

普通測試失敗、build fail、暫時性系統錯誤不得直接丟給使用者。

---

## 8. Retry / Pause

所有 retry 必須留下歷史：

- retry_count
- previous_error
- last_attempt_at
- retry_reason

禁止固定短週期無限重試。

Quota 問題：

`Paused / QUOTA_PAUSED`

系統持續錯誤：

`Paused / SYSTEM_ERROR_PAUSED`

恢復後接續原 Run，不重複建立相同工作。

---

## 9. Verification

Node 顯示 Success 不代表 Run 成功。

Run 只有在必要 Verification 通過後才能標示：

`Success`

例如程式修改：

Modify Code ✓
Unit Test ✓
Browser Test ✓
Spec Check ✓
Git Push ✓

之後 Run 才能 Success。

---

## 10. V1 Views

### Runs

所有目前與歷史 Run，可依狀態、Project、Task 篩選。

### Graph

唯讀節點圖。

### Timeline

事件時間線。

### Detail

Input / Output / Logs / Error / Verification / Artifact。

---

## 11. V2

V1 穩定後才考慮 Workflow Editor：

- Trigger
- AI
- Tool
- Condition
- Verification
- Human Gate
- Output
- 拖拉節點
- 自訂分支與重試規則

V2 必須沿用相同 Run / Node 資料模型，不另造第二套系統。
