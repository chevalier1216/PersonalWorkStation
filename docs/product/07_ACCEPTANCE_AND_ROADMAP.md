# Acceptance Criteria & Roadmap

版本：`ver.26.09.22.1516`

## 1. V1 核心驗收

V1 必須實際證明：

- 可建立 Task
- 看板欄位可新增 / 改名 / 刪除
- 支援 Regular / High / Urgent
- 支援 checklist / notes / blocked
- 可關聯 Google Calendar
- 提醒規則可依工作日與重要度運作
- AI Chat 可建立或觸發 Task
- 可建立唯一 Run ID
- Run 可關聯 Task / Project
- Run 至少包含 Trigger / Context / Execution / Verification / Output
- Node 狀態可更新並在重新整理後保留
- Graph 可查看目前節點
- Timeline 可查看重要事件
- Failed Node 可查看 Error
- Retry 不覆蓋歷史
- Waiting Human 會出現在 Today
- Task ↔ Run 可雙向開啟
- Success 必須經 Verification
- GitHub 任務可關聯 Commit / PR / Issue
- 外部服務失敗不會讓整個工作台不可使用
- 使用者不需要在 Chat / Work / Codex 間人工搬運固定 Prompt

## 2. V1 不做

- 通用自動化 SaaS
- Workflow Builder
- 任意節點拖拉
- 複雜 Multi-Agent UI
- 桌面通知
- 逐 Token 顯示 AI 私有推理
- 額外付費 API 作為必要依賴

## 3. 後續 Roadmap

### V1

工作台 + 可觀測 AI Workflow。

### V1.x

改善 Graph、搜尋、歷史比較、Run 分析。

### V2

Workflow Editor / Builder。

V2 允許視覺化配置 Trigger、AI、Tool、Condition、Verification、Human Gate、Output，但必須沿用 V1 的 Run / Node 資料模型。
