# AI Chat & Summary

## AI

使用 OpenAI Responses API。

模型：

GPT-5.6 Sol

Reasoning：

xhigh

Server-side 呼叫。

## Chat UI

兩個入口：

### 今日

精簡 Chat。

適合：

- 快問
- 快速建立 Task

### AI 對話

完整 Chat 頁。

支援：

- 多輪對話
- Conversation history
- Search
- 開啟舊 Conversation

## AI 可讀資料

預設可依需求讀：

- Tasks
- Calendar
- Notes
- AI Summary

只取得與當前問題相關資料。

禁止每次載入整個資料庫。

## AI Actions

可直接：

- 新增 Task

需確認：

- 修改 Task
- 刪除 Task
- 建立 Calendar relation
- 修改 Calendar relation

## Chat History

完整聊天紀錄持久保存。

目前 Conversation 使用 OpenAI conversation state / compaction。

不得每輪重新傳送全部聊天歷史。

## Cross-chat Retrieval

V1 不自動建立長期記憶。

只有使用者明確要求，例如：

> 找我以前談過 XXX 的內容。

才搜尋歷史 conversation 並帶入相關內容。

## @AI Summary

Task Activity 支援 `@AI`。

整理結果不得直接覆寫原 Task。

預設建立：

**AI Summary Card**

只有使用者明確要求建立待辦時才建立 Task。

## Summary Title

AI 依內容濃縮命名。

必須：

- 人類可讀
- 有具體意義

禁止使用只有：

- 摘要
- 進度整理
- 工作摘要

等空泛標題。

## Summary Relations

Summary ↔ Source Task 必須雙向連結。

## Version

允許多份，不覆蓋。

格式：

`v.YY.MM.DD.HHmm`

例如：

`v.26.08.21.1915`

同分鐘重複：

`-2 / -3`

內部仍使用 UUID。

## 新版本規則

舊 Summary：

Description 第一行增加最新版本連結。

新 Summary 最上方先列：

- 與上一版不同的決策
- 已完成
- 已取消
- 已取代

再顯示完整摘要。

## Timeline

Summary 版本鏈使用時間軸。

不得使用 v1 / v2 / v3。

