# AI Chat

版本：`ver.26.09.22.1516`

## 1. 角色

AI Chat 是工作台內的需求與討論入口。

工作台網頁內的 ChatGPT 對話入口暫停，不列入目前 V1 驗收。2026-09-25 的一般「對話」實測未取得可操作 PersonalWorkStation 真實 Task 的連線；在可驗證的對話操作能力建立前，不恢復網頁內 ChatGPT 開啟與摘要交接入口。不得改用 Work 額度或付費 API 假裝滿足此需求。

2026-09-26 使用者指定替代形式：在 Windows 桌面版 ChatGPT 的一般「對話」中，以內建瀏覽器開啟已登入的 PersonalWorkStation，直接對工作台下指令；不得消耗 Work 額度或使用付費 API。工作台可提供限於目前登入帳號的站點工具，先支援列出、建立及修改 Task，沿用既有資料庫權限與驗證。此形式仍須以指定帳號、GPT-5.6 Sol High 在桌面版實際完成真實 Task 建立／修改、重整保留及來源核對，才可列為通過；瀏覽器測試或單純顯示站點工具不等於完成。若帳號或模型不支援站點工具，維持暫停並回報原因，不改走 Work 或 API。當前 Task／Run 確認建立及手動 Summary 不依賴此入口。

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
