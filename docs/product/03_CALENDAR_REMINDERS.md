# Calendar & Reminders

版本：`ver.26.09.22.1516`

## 1. Calendar

與 Google Calendar 同步。

重要 Task 必須可關聯 Calendar event。

Windows 桌面版 ChatGPT 內建瀏覽器可透過 `calendar_create_event` 建立目前登入者主要 Google Calendar 的獨立事件。這條路徑不建立 Task 或 Run，也不以工作台快取代替 Google event。輸入至少包含標題與帶 UTC offset 的 RFC 3339 開始時間；結束時間預設為 30 分鐘後，時區預設 `Asia/Taipei`，說明為選填。

相同使用者與相同事件內容的工具重試必須回傳既有 event，不得重複建立；成功後須更新工作台事件快取與同步狀態。日期格式、IANA 時區及結束時間晚於開始時間均須在寫入前驗證。

## 2. 提醒原則

工作台內提醒，不使用桌面通知。

High / Urgent 若沒有日期，當日下午提醒。

有日期的重要工作，採多階段提醒：

- 五個工作天前
- 三天前
- 前一天

## 3. 假日規則

- 工作日計算以中國假日規則為主
- 首頁另顯示台灣節日提醒

## 4. Calendar 與 Run

Calendar event 可作為 AI Run 的 Trigger。

例如：

- 會議前產生摘要
- 到期日觸發檢查
- 指定日期執行工作

實際執行狀態一律進 AI Execution Center，不在 Calendar 內重複建立第二套狀態模型。
