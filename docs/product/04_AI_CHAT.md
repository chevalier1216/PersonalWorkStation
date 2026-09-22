# AI Chat

版本：`ver.26.09.22.1516`

## 1. 角色

AI Chat 是工作台內的需求與討論入口。

它負責：

- 問答
- 規劃
- 建立 Task
- 觸發 AI 工作
- 顯示關聯 Run

## 2. 可執行需求

當使用者下達可執行任務，例如：

> 修正 Mahjong Issue #5

Chat 不只回覆「正在處理」，而是：

1. 建立或關聯 Task
2. 建立 Run
3. 回傳 Run ID 與目前狀態
4. 允許直接開啟 AI Execution Center

## 3. 跨工具交接

使用者不應手動在 Chat、Work、Codex、GitHub 之間複製固定 Prompt。

專案既有規則需由系統自動繼承，例如：

- commit / push
- 不破壞已定案功能
- 執行測試
- 失敗後先自動修正
- 完成後回寫狀態

## 4. Human Gate

只有以下情況才要求使用者介入：

- 未定案產品決策
- OAuth / 登入
- 權限不足
- 破壞性 / 不可逆操作
- 多個互斥方案且既有規格無法判定

其餘普通錯誤由 AI Execution Center 的 Retry / Pause 機制處理。
