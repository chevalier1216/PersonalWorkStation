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
要求 AI 建 Task
→ 直接建立
→ Board 出現
```

## AI Modify

```text
要求 AI 修改
→ 先確認
→ 確認後修改
```

## AI Summary

```text
@AI 整理
→ 建 Summary
→ 原 Task 不變
→ 雙向連結
```

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

