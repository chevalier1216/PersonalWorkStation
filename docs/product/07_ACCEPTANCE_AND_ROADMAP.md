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
- 本機 bridge 可將 Waiting External Run 交付既有 Codex CLI，並回寫 Node、Log、Verification、Artifact 或 Human Gate
- Today 可顯示玉山官方 USD、RMB/CNY、JPY、EUR、AUD 的即期與現金買入／賣出，失敗時保留最後成功資料
- ChatGPT 桌面版內建瀏覽器可探索並經原生確認呼叫 `calendar_create_event`，在目前登入者 Google Calendar 建立獨立 event，且不建立 Task／Run
- Calendar Site Tool 回傳真實 event ID，工作台同步與重新整理仍可見；相同呼叫重試不重複建立
- 未登入、未列入 `allowed_users`、Google 授權失效者均不能透過 Site Tool 寫入；Guest Preview 若存在也不得完成私人寫入
- 同瀏覽器恢復 Supabase Session 與 Google Access Token 到期後可用 refresh token 靜默續期；`invalid_grant` 最多引導一次重新連結

## 2. V1 不做

- 通用自動化 SaaS
- Workflow Builder
- 任意節點拖拉
- 複雜 Multi-Agent UI
- 桌面通知
- 逐 Token 顯示 AI 私有推理
- 額外付費 API 作為必要依賴

### 暫存項目（使用者於 2026-09-25 調整）

- 工作台網頁內的 ChatGPT 對話入口暫不列入 V1 驗收，相關入口須停用。Windows 桌面版 ChatGPT 一般「對話」透過內建瀏覽器站點工具直接操作真實 Task，需依 `04_AI_CHAT.md` 完成指定帳號實機驗證才可列為通過；尚未實測前不得以功能程式或自動化測試代替驗收，不得改用 Work 額度或付費 API。
- `calendar_create_event` 同樣須以指定正式帳號、實際支援 Site Tools 的 ChatGPT 桌面客戶端完成真實 Google event、重整、防重、拒絕案例及 token 過期續期證據；程式、本機測試或工具出現在地址列均不等於正式驗收。

## 3. 後續 Roadmap

### V1

工作台 + 可觀測 AI Workflow。

### V1.x

改善 Graph、搜尋、歷史比較、Run 分析。

### V2

Workflow Editor / Builder。

V2 允許視覺化配置 Trigger、AI、Tool、Condition、Verification、Human Gate、Output，但必須沿用 V1 的 Run / Node 資料模型。
