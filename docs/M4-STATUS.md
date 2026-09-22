# M4 ChatGPT Browser Handoff Status

日期：2026-09-22

## 產品決策修正

先前的 OpenAI API／Work 方向已被 authoritative PRD 取代。舊 server-side AI source、migration 與 request 測試已移除。

## 目前狀態

- Today 與完整 AI 頁都提供 ChatGPT 一般對話入口，標示 GPT-5.6 Sol High。
- 提示使用 URL 預填並同步複製；ChatGPT 未套用預填時可直接貼上。
- UI 明確要求確認「對話／高」，禁止 Work 與 OpenAI API。
- ChatGPT 無法直接改工作台資料；Task 建議必須回到工作台確認。
- Desktop／mobile browser handoff 與 Task failure isolation 已通過 E2E。
- 實機確認帳號切回一般「對話／高」，且新頁沿用此狀態；URL 本身不能強制模式，production smoke 仍需在正式站重驗。

M4 修正後本機實作完成；正式站 smoke 尚未完成。
