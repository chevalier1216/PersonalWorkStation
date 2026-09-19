# Data, Storage & Maintenance

## Supabase

負責高頻結構化資料：

- Tasks
- Board
- Tags
- Checklist
- Notes
- Status history
- Chat text
- Notifications
- AI Summary
- Search metadata
- Layout preference

## Google Drive

負責大型或長期內容：

- Images
- PDF
- Office
- Archive
- Export
- 大型附件

## Archive Directory

```text
PersonalWorkStation/
├── Chat/
├── Tasks/
├── Attachments/
└── Exports/
```

再依：

`YYYY/MM`

分類。

## Archive Policy

雙條件：

### 時間

例如附件 90 天未使用。

### 容量

任一主要 Storage 接近 70%。

Agent 應先嘗試安全 Archive / Cleanup。

## Archive Flow

必須依序：

1. 上傳 Drive
2. 驗證 Drive 可讀
3. 更新 metadata
4. 更新 archive location
5. 驗證可從工作台找回
6. 才允許刪除原始大型資料

任一步失敗：

- 不刪原件
- 建立通知

## Capacity Monitoring

監控：

- Supabase Database
- Supabase Storage
- Google Drive

接近 70%：

Agent 先嘗試處理。

若：

- 無資料可安全搬移
- Archive 無法解決
- Google Drive 本身接近容量
- 預估仍將超限

通知使用者。

禁止靜默刪除資料。

## Archive Search

至少可依：

- Filename
- Source Task
- Date
- Metadata

找回 Drive 檔案。

V1 不要求 OCR 全文搜尋。

## Backup

定期產生 metadata / index backup。

目標：

Supabase 嚴重損壞時可重建主要關聯。

不得把 Secret 寫入備份。

