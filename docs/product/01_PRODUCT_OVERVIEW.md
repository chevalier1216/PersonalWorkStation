# Product Overview

版本：`ver.26.09.22.1516`

## 1. 產品目標

建立個人使用的 AI 工作台，開啟網頁即可集中處理：

- Today / 待辦
- Tasks / 看板
- Calendar
- AI Chat
- AI 執行狀態
- 搜尋
- 匯率
- 歷史 / Archive

核心原則：使用者只提出一次需求，系統負責持續執行、驗證、回寫；只有真正需要產品決策、權限或破壞性操作時才要求人工介入。

## 2. 首頁

首頁採模組化，可拖曳排序、顯示或隱藏。

V1 至少包含：

- Today
- Tasks 摘要
- Calendar
- AI 執行狀態
- 工作台內通知
- 外幣兌新台幣匯率

AI 執行狀態需顯示：

- Running
- Waiting Human
- Failed
- Completed Today

## 3. 共通 UX

- 中文化、簡潔
- 不使用桌面通知
- 未填欄位提示但不強制全填
- 重要資訊需可從首頁快速進入
- Blocked / Waiting Human 等阻擋狀態需醒目但不遮蔽主要操作
- 所有長任務需有可追蹤狀態，不只顯示「處理中」

## 4. 匯率

顯示指定銀行之外幣兌新台幣匯率，區分：

- 買入
- 賣出

## 5. 非目標

V1 不做：

- 對外 SaaS 商業平台
- 桌面通知
- 通用 Zapier / n8n 替代品
- 複雜 Multi-Agent 展示介面
- 自由拖拉的 Workflow Builder
