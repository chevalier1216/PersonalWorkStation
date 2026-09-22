# AI 個人工作台 PRD Index

版本：`ver.26.09.22.1516`
狀態：整合定稿結構

本組文件取代單一超長 PRD 的寫法。既有產品決策與新增的 AI 執行中心已整合進同一套 authoritative PRD，但依功能模組拆分，避免重複描述。

## 文件結構

- `01_PRODUCT_OVERVIEW.md`：產品定位、首頁、共通 UX、非目標
- `02_TASK_BOARD.md`：看板、卡片、子任務、Blocked、歸檔、搜尋
- `03_CALENDAR_REMINDERS.md`：Google Calendar、提醒、假日規則
- `04_AI_CHAT.md`：工作台內 AI 對話與任務觸發
- `05_AI_EXECUTION_CENTER.md`：Run / Node / Graph / Timeline / Human Gate / Retry / Verification
- `06_DATA_INTEGRATIONS_ARCHITECTURE.md`：Supabase、Google Drive、GitHub、OAuth、安全、封存
- `07_ACCEPTANCE_AND_ROADMAP.md`：整體驗收、V1 邊界、後續階段

## Authoritative 原則

1. 同一規格只在一個檔案定義；其他檔案只引用，不重複抄寫。
2. Tasks 定義「要完成什麼」；AI Execution Center 定義「AI 實際怎麼完成」。
3. Workflow Monitor 是個人工作台核心模組，不另做第二套獨立工具。
4. V1 先做可觀測性，不做自由拖拉式 Workflow Builder。
