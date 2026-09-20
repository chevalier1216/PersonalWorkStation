# M2 最小可驗證實作計畫

基準：`00-PRODUCT-OVERVIEW.md`、`01-TASKS-TODAY.md`、`05-UI-UX.md`、`06-TECHNICAL-ARCHITECTURE.md`、`07-ACCEPTANCE-TESTS.md`、`08-EXECUTION-RULES.md`。

1. 擴充 Task recurrence、通知、Today 版面偏好與官方工作日資料模型；所有私人資料維持 owner／RLS 邊界。
2. 完成 recurring Task 的原子流程：完成舊 Task 後只建立一次下一周期 Task，複製規格指定欄位、排除 Notes／Deliverable／舊關聯，並建立通知。
3. 完成前置任務解除通知與每日 15:00 未排程 High／Urgent 去重提醒。
4. 建立 Today 閱讀模式：逾期、今日、未來 5 個中國實際工作日、未排程與通知；依 Urgent → High → Regular、截止時間排序。
5. Today 模組支援排序、顯示／隱藏並持久保存；V1 不做自由 resize。
6. Task 詳細資料可設定 Daily／Weekly／Monthly／Custom recurrence。
7. 以資料庫整合測試及桌面／手機 E2E 驗證 recurrence、通知、重整保存與失敗隔離，再套用 production migration 並做真實 smoke test。

中國工作日資料以官方公告為權威來源，平日／週末只作基準，再用官方假日與補班覆蓋。台灣假日只產生首頁提醒，不改變中國工作日計算。自動更新來源與 server-side schedule 必須在宣稱 M2 完成前實際可執行並驗證。
