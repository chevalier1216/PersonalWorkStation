# 2026-09-19 M1 核心實作驗證

## 已完成

- 9 份 docs/product 規格原文落檔並推送，規格 commit `c71ac5120721e05761ea4a8d369f9d531c9e8ae8`。逐份比對來源內容一致，僅忽略檔尾空白差異。
- 可操作的繁體中文 Task / Board 核心 UI；Supabase client、migration、RLS、allowlist 與原子 RPC。
- Task 建立／編輯／刪除、優先度、截止時間、跨欄拖曳／選單搬移／排序。
- Board 新增／改名／排序／同語意替代刪除；狀態轉換歷史与完成時間。

## 本機驗證

- TypeScript 與 production build 通過。Build 仍提示主 bundle 大於 500 kB，尚未作效能驗收。
- PostgreSQL 相容引擎 PGlite：4 個整合案例通過，涵蓋實際 migration、RLS、跨 owner 防護、原子 rollback、任務歷史與欄位替代。
- Chromium 桌面及 Pixel 7 viewport：6 個 E2E 通過，涵蓋建立、修改、移動、排序、刪除、欄位替代、重整保存及模擬連線失敗時表單／既有資料保留。
- E2E 使用獨立 test-only PGlite 資料庫，非 hosted Supabase，不證明 OAuth 或正式服務可用。觸控裝置以移動選單驗證；滑鼠拖曳於桌面驗證。
- npm audit：0 vulnerabilities。
- `.env.local` 被 Git 忽略，未提交密碼、私人設定或憑證。

## 當時未驗證與阻塞

以下為核心 commit 當時的狀態。後續 production 驗證結果以 `M1-DETAILS-VALIDATION.md` 為準。

- Supabase 控制台 Google provider 尚未完成有效 OAuth Client ID／Secret 設定。
- 真實專案 migration 套用須取得 production 授權；尚未套用。
- 尚未指定並授權單一使用者 UUID。
- 真實 Google 登入、Supabase hosted CRUD／重整、正式 GitHub Pages smoke test 未驗證。
- 未 merge main、未正式發布；原始 repository 為空，因此目前只有工作分支。
- M1 其餘 Task optional 欄位仍未實作；詳見 M1-PLAN，不代表需求已移除。

遠端 CI 與最終提交資訊以對應 commit 的 GitHub Actions 與私人 Drive 版本紀錄為準。
