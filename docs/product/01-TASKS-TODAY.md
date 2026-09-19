# Tasks & Today

## Board

預設：

- Todo
- Doing
- Done

允許：

- 新增欄位
- 改名
- 排序
- 刪除

但底層必須保留：

- 未開始
- 進行中
- 已完成

若刪除 Doing / Done 對應欄位，必須先指定替代欄位。

## Task 基本欄位

只需 Title 即可建立。

其他皆 optional：

- Description
- Priority
- Tags
- Start date
- Due date / time
- Checklist
- Recurrence
- Estimated duration
- Calendar relation
- Task relations
- Attachments
- Activity / Notes
- Deliverable

缺欄位不得阻擋建立。

## Priority

固定：

- Regular
- High
- Urgent

預設 Regular。

不設 Low / Medium。

## Today

首頁順序包含：

- 逾期未完成
- 今日任務
- 今日 Calendar
- 未來 5 個實際工作日
- 未排程任務
- AI Chat
- 通知

Task 預設排序：

`Urgent → High → Regular`

同級依截止時間。

允許手動拖曳覆蓋預設順序。

## 未排程

沒有 Due Date 的 Task 顯示於「未排程」。

每天 15:00：

若仍有未排程的 High / Urgent，建立工作台通知。

同一天不得重複提醒。

## Start Date

Start Date optional。

若開始日在未來 5 個工作日內：

顯示於對應日期並標記「尚未開始」。

超過 5 個工作日：

只保留於 Board。

## Checklist

支援：

- Title
- Completed
- Optional due date

不設 Priority。

若 Task 完成時仍有未完成 Checklist：

顯示一次警告，但允許完成。

## Recurring Task

支援：

- Daily
- Weekly
- Monthly
- Custom

完成後：

自動建立下一周期 Task + 通知。

複製：

- Title
- Description
- Priority
- Tags
- Checklist structure
- Estimated duration
- Recurrence

不複製：

- Notes / Activity
- Deliverable
- Completion state
- 舊 Calendar event
- 舊 Task blocking relation

## Task Relations

支援：

- 前置任務
- 後續任務
- 相關任務

前置 Task 未完成：

原 Task 照常顯示於正常位置，但醒目標示「被阻擋」。

顯示：

- 阻擋原因
- 前置 Task
- 可點擊跳轉連結

被阻擋 Task 仍可手動移至 Doing。

阻擋提示保留直到解除。

前置 Task 完成後：

自動解除阻擋並產生通知。

## Activity / Notes

獨立於 Description。

每筆：

- Timestamp
- Content
- Optional attachment

用於：

- 工作進度
- 討論
- 決策
- 延誤
- 問題
- 補充紀錄

## Attachments

Task 本體與 Activity 均可附：

- 圖片
- PDF
- Office
- 壓縮檔
- 其他檔案

## Done

Done 依月份分組。

Board 顯示：

- 本月
- 上月

更舊自動 Archive。

每個 Task 保留：

`completed_at`

以便確認具體完成日期與時間。

## Deliverable

Optional。

可填：

- Link
- File
- PR
- Document
- Conclusion
- 完成說明

## 工時

Estimated Duration optional。

AI 可協助估算。

Actual 基準：

Task 進入 Doing 到 Done 的完整 elapsed time。

每次進入 / 離開 Doing 都要保存 timestamp。

不建立 Pause 狀態。

若 Notes 說明有約略耽誤時間，`@AI` 可產生：

- Raw elapsed duration
- Adjusted actual duration
- Deducted duration
- Reason
- Source Note

不得覆蓋原始紀錄。

## Search

支援：

- 全域搜尋
- 指定欄位搜尋

欄位：

- Title
- Description
- Activity / Notes
- Deliverable
- Tags
- Priority
- Status
- Date
- Calendar relation

若命中某筆 Note：

點擊後直接定位至該 Note。

## Tags

自由新增文字 + 自訂顏色。

V1 不做 Tag group。

