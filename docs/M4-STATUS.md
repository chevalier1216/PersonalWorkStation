# M4 ChatGPT Browser Handoff Status

日期：2026-09-22

## 產品決策修正

先前的 OpenAI API／Work 方向已被 authoritative PRD 取代。既有 server-side AI source 與測試不再代表 V1 目標，必須在 browser handoff 實作完成後移除。

## 目前狀態

- PRD 已改為 ChatGPT 一般對話、GPT-5.6 Sol High。
- 明確禁止 Work 與 OpenAI API。
- Browser handoff、popup fallback、Task 草稿帶回與 production smoke 尚待重新實作及驗證。

因此 M4 目前為「重新實作中」，不得引用舊的 API fixture 結果宣稱完成。
