# Tasks / Board

版本：`ver.26.09.22.1516`

## 1. 看板

預設欄位：

- Todo
- Doing
- Done

允許新增、改名、刪除欄位。

## 2. 卡片欄位

卡片支援：

- Title
- Description
- Priority：Regular / High / Urgent
- Checklist
- Notes
- Calendar 關聯
- Tags
- Estimate
- Actual Time
- Blocks / Blocked by
- Blocked Reason
- AI Execution 關聯
- completed_at

新增卡片時缺少欄位只提示，不強制填滿。

## 3. 子任務

使用 checklist。

## 4. Notes

卡片下方提供連續註記，不覆蓋 Description。

`@ai` 註記可作為 AI 補充延誤原因、時間調整等依據。

## 5. Blocked

支援：

- blocks
- blocked by
- reason
- linked task

被阻擋卡片仍保留原位置，但需醒目顯示。

## 6. AI 摘要卡

AI 摘要或重整內容時：

- 建立新卡，不覆寫原卡
- Title 由內容重點縮略
- 原卡第一行記錄新卡位置
- 新卡頂部標註差異 / 已完成內容

## 7. Done / Archive

Done 以月份分區。

保留完成日期戳記，不因歸檔遺失。

## 8. 搜尋

支援依欄位分類搜尋。

## 9. 與 AI Execution Center 的關係

Task 表示「要完成什麼」。

任何可追蹤 AI 執行可關聯一個或多個 Run。

卡片上顯示：

- Run 狀態
- Run ID
- Current Node
- 執行時間

點擊可直接進入 AI Execution Center。
