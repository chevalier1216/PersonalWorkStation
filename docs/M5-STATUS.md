# M5 Status — AI Summary Browser Handoff + History Search

日期：2026-09-22

## 已保留的可用成果

- Summary Card schema、版本標籤、上一版／最新版關聯與差異欄位。
- Task、Notes、Calendar relation 與 Summary 的工作台歷史搜尋。
- Note 與 Summary 結果可返回來源 Task。

## 修正後已完成（本機）

- 已移除付費 API Edge Function、Chat persistence migration 與相關 request contract。
- `在 ChatGPT 整理` 會帶入目前 Task、Notes、Checklist、狀態歷史與前一版 Summary。
- 使用者可將結果貼回工作台，建立具體標題、差異欄位與完整摘要的 Summary Card。
- 已移除 Supabase ChatGPT conversation 複本與工作台 Chat 搜尋入口；ChatGPT 歷史由 ChatGPT 保存。
- Summary 版本鏈、refresh persistence、Summary index、Note 搜尋及 desktop/mobile E2E 已通過。

M5 修正後本機實作完成；production migration 與正式站 smoke 尚未完成。
