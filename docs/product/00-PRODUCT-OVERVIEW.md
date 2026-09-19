# PersonalWorkStation V1 — Product Overview

## 產品目標

PersonalWorkStation 是單人使用的 Web AI 工作台。

首頁核心問題：

> **我今天要做什麼？**

V1 必須真的可以日常使用，不接受只有 Dashboard、UI Skeleton、Placeholder 或「未來可串接」的半成品。

## V1 Scope

必須完成：

- 今日首頁
- Task / Board
- Google Calendar 整合
- 工作台內通知中心
- AI Chat
- AI 操作 Task
- AI Summary
- Chat / Task 歷史搜尋
- Supabase persistence
- Google Drive 長期附件封存
- 自動資料維護
- Desktop + Mobile 核心功能
- GitHub Pages 正式部署

## V1 Non-goals

不做：

- FX / 股票
- 多使用者 SaaS
- Team / Role / Permission
- 飛書登入實作
- Browser desktop notification
- 自動跨 Chat 長期記憶
- Google Calendar 通用事件編輯器
- OCR 全文索引
- Plugin Framework
- 自由 resize Dashboard
- 為未來功能預建大型抽象架構

## 核心原則

1. 可用產品優先於架構完整。
2. 每個 Milestone 必須產生可操作 end-to-end flow。
3. 外部服務故障不得拖垮核心工作台。
4. Personal Settings、Secrets、私人資料不得進 Public GitHub Repo。
5. 一般工程問題由 Codex 自動處理，不等待使用者反覆輸入「GO / 繼續」。

## 文件權威順序

1. `00-PRODUCT-OVERVIEW.md`：產品 Scope 與原則
2. 各 Domain spec：具體行為
3. `07-ACCEPTANCE-TESTS.md`：完成判定
4. `08-EXECUTION-RULES.md`：Codex / Work 執行規則

若文件衝突，依以上順序判定；不得自行腦補新需求。

