# M1 最小可驗證實作計畫

基準：docs/product/00、01、04、05、06、07、08。產品規格原文保持不變。

1. 建立 React / TypeScript / Vite 應用，繁體中文任務看板；僅提供可工作的 M1 功能。
2. Supabase migrations：私人 Board 欄位、Task、狀態歷史，RLS 與單一帳號 allowlist；以原子 RPC 處理排序、搬移與欄位刪除。
3. Google OAuth 登入並保存 session。僅需標題即可建立 Task，預設 Regular；可編輯、刪除、移動、排序，保存 Doing 進出與完成時間。
4. Board 新增、改名、排序、刪除及替代欄位，保留 todo / doing / done 語意。
5. 所有資料操作使用 Supabase；未設定連線時明確顯示設定需求，不以 mock 或 localStorage 假裝完成 persistence。
6. 執行型別、單元／資料庫整合、瀏覽器 E2E 與 build；終端啟動並確認 dev server。
7. 真實 Supabase／Google OAuth 設定完成後，再驗證登入、建立、移動、重整與 RLS。正式部署與 main merge 另需授權。

M1 驗收集中在 Task persistence 與 Board persistence。Recurring、Today、通知、Calendar、AI、附件等依 08 的後續里程碑執行；不以空白頁宣稱完成。

外部設定狀態：Supabase URL 與 publishable key 已寫入忽略提交的本機設定；GitHub 推送已恢復；Drive 版本紀錄位置已由使用者指定。尚待 production migration 套用授權、Google OAuth 正確設定及指定使用者 UUID。

本次交付是 M1 核心第一段，尚未宣稱 M1 全部完成。Task 其餘 optional 欄位（開始日期、標籤、Checklist、Notes、關聯、Deliverable）仍須依 01 實作與驗收；不得因本次核心測試通過而視為已完成或刪除需求。
