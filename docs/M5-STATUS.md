# M5 Status — AI Summary Browser Handoff + History Search

日期：2026-09-22

## 已保留的可用成果

- Summary Card schema、版本標籤、上一版／最新版關聯與差異欄位。
- Task、Notes、Calendar relation 與 Summary 的工作台歷史搜尋。
- Note 與 Summary 結果可返回來源 Task。

## 需重新實作及驗證

- 移除付費 API Edge Function 與相關 request contract。
- 將 `@AI 整理` 改為 ChatGPT 一般對話 browser handoff。
- 提供使用者將整理結果建立為 Summary Card 的明確操作。
- 移除 Supabase ChatGPT conversation 複本與 Chat 搜尋承諾。

因此 M5 目前為「部分保留、重新實作中」，舊的 API fixture 與 E2E 結果不代表修正後 V1 完成。
