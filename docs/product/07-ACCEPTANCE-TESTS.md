# Acceptance Tests

以下為 V1 完成判定的最低集合。

## Task Persistence

```text
Quick Add
→ Task 出現
→ 移至 Doing
→ Refresh
→ 狀態仍存在
```

## Board

```text
新增欄位
→ 改名
→ 排序
→ Refresh
→ 保留
```

## Recurring

```text
完成 Recurring Task
→ 下一周期 Task 建立
→ Notification
```

## Checklist

```text
仍有未完成 Checklist
→ 完成 Task
→ 顯示警告
→ 確認後仍可完成
```

## Calendar

```text
Task
→ 建立 Calendar relation
→ Google Calendar 實際存在
```

## Calendar Failure

```text
API failure
→ Task 保留
→ Notification
→ Retry
```

## Blocking

```text
前置 Task 未完成
→ 顯示被阻擋
→ 可跳轉
→ 仍可移至 Doing
→ 阻擋標記仍存在
```

完成前置：

```text
→ 自動解除
→ Notification
```

## Activity

```text
新增 Note
→ Refresh
→ Note 保留
```

## Search

```text
搜尋 Note 內容
→ Result
→ 點擊
→ 定位至命中 Note
```

## AI Create Task

```text
在工作台輸入建 Task 要求
→ 開啟 ChatGPT 一般對話頁
→ 提示已預填，或已複製且可直接貼上
→ 頁面不是 Work
→ 使用者確認 High 後送出
→ 將建議帶回工作台確認
→ 建立後 Board 出現
```

## AI Modify

```text
要求 AI 修改
→ ChatGPT 只產生修改建議
→ 工作台資料尚未改變
→ 使用者回到工作台確認並執行
```

## AI Summary

```text
@AI 整理
→ 開啟 ChatGPT 一般對話頁並預填或複製 Task context
→ 使用者確認 High 後送出
→ 將結果帶回工作台建立 Summary
→ 原 Task 不變
→ 雙向連結
```

## AI Usage Boundary

```text
任何 AI 入口
→ 不開啟 Work
→ 不呼叫 OpenAI API
→ 不要求 API key
→ 不產生 Work 額度或 API token 費用
```

瀏覽器 smoke test 必須確認 ChatGPT 頁面顯示一般「對話」模式與 High。若 ChatGPT 帳號方案或網頁狀態無法提供 Sol 5.6 High，標示未驗證，不得自行升級方案或改用付費 API。

## Summary Version

```text
建立新 Summary
→ 新版顯示差異
→ 舊版第一行指向最新版
→ Timeline 正常
```

## 未排程提醒

```text
15:00
→ High/Urgent 無日期
→ Notification
```

## Archive

```text
附件
→ Drive Archive
→ 驗證可讀
→ Metadata 更新
→ 工作台可重新開啟
```

## Archive Failure

```text
Drive failure
→ 原件保留
→ Notification
```

## Production

```text
正式 Web URL
→ Login
→ 建立 Task
→ Refresh
→ 資料存在
```

## Completion Definition

任何功能只有同時符合：

- UI 可操作
- Persistence 正常
- Refresh 不遺失
- Error state 已處理
- Unit / integration test 通過
- Browser E2E 通過
- Build 通過
- 正式部署 smoke test 通過

才算完成。
