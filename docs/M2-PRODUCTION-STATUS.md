# M2 Production Status

日期：2026-09-20

## 已完成

- Production migrations `202609200002_today_recurring.sql` 與 `202609200003_m2_constraints.sql` 已套用至 Supabase project `wcvaazjhkczdgtudssdl`。
- Schema readback：4 個 recurrence 欄位、`notifications`、`today_preferences`、`calendar_days`、75 筆初始官方工作日資料與必要 RPC 權限均存在。
- PostgREST schema cache 已重新載入，真實 Google OAuth 使用者可呼叫 `workspace_command`。
- Production-backed smoke：Today 首頁、2026-09-25 中國假日跳過、循環任務完成後只建立一筆下一周期任務、通知中心新增未讀通知，均實際通過。
- `refresh-holidays` Edge Function 已部署；來源解析器以中國國務院公告與台灣 DGPA CSV 為資料來源，先完整驗證再以 transaction 替換資料，失敗保留舊資料並建立通知。

## 驗證

- `npm test`：3 files / 12 tests passed。
- `npm run test:e2e`：desktop + mobile 共 10 tests passed。
- `npm run build`：passed。
- 官方來源即時解析：CN 39、TW 22，共 61 筆。

## 尚待啟用

- GitHub Actions 每週同步 workflow 已完成；需將同一個隨機 `HOLIDAY_SYNC_SECRET` 儲存於 Supabase Edge Function secrets 與 GitHub repository secrets，並設定現有 publishable key secret 後，才能啟用與執行 production schedule。
- 此 secret 只允許觸發固定官方來源同步，不授予一般資料讀寫或管理權限。

## Production 驗證資料

- `M2 production recurrence smoke · 2026-09-20`：原任務位於 Done；由 recurrence 產生的下一周期任務位於 Todo，作為 production persistence 證據。
