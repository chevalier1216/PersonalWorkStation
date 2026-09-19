# Calendar

## V1 Scope

V1 提供：

- 顯示 Google Calendar
- Task 建立 Calendar event
- Task 關聯 Calendar event
- 選擇要顯示哪些 Calendar

V1 不做：

一般 Google Calendar event 的完整新增 / 編輯 / 刪除 UI。

## Task Relation

V1：

一 Task 最多對一 Calendar event。

資料模型不得阻礙未來擴充一對多。

有時間：

建立 timed event。

只有日期：

建立 all-day event。

Task 完成：

Calendar event 保持原樣。

不得自動刪除或修改。

## Today Calendar

顯示：

- 今天
- 未來 5 個實際工作日

同一天：

有明確時間的 Task 與 Calendar event 依時間混排。

無時間 Task 放該日底部。

## 中國工作日

工作日基準：

中國大陸官方行事曆。

必須正確處理：

- 法定假日
- 調休
- 補班

不得單純使用 Mon–Fri 判斷。

資料應自動更新。

## 台灣假日

不影響中國工作日計算。

只做首頁額外提醒。

提醒：

- 14 天前
- 3 天前
- 1 天前

## Failure Isolation

Calendar API 失敗：

- Task 資料仍保存
- 工作台繼續運作
- 標示同步失敗
- 寫入通知中心
- 提供 Retry

使用者必要時可自行至 Google Calendar 處理。

