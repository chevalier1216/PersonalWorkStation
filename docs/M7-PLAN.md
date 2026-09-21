# M7 最小可驗證實作計畫

依 `00-PRODUCT-OVERVIEW.md`、`05-UI-UX.md`、`06-TECHNICAL-ARCHITECTURE.md`、`07-ACCEPTANCE-TESTS.md`、`08-EXECUTION-RULES.md` 執行。

1. 補齊權威規格所列七個主導覽入口，讓 Calendar、AI Summary、History、Settings 都有可操作頁面。
2. 保持既有鐵灰玻璃視覺，補強鍵盤跳轉、行動版水平導覽與內容可讀性。
3. 更新 README 與正式發布工作流；工作流只在 `main` 執行，feature branch 不發布。
4. 以 desktop 與 mobile E2E 驗證七個入口、Calendar、AI Summary 深連結及既有核心流程。
5. 完成 typecheck、unit/integration、完整 E2E、production build；正式 URL 仍須在授權合併與部署後 smoke test。
