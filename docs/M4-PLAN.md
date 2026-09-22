# M4 — ChatGPT Browser Handoff + AI Task Drafts

## 目標

從 PersonalWorkStation 開啟 ChatGPT 一般對話頁，使用現有 ChatGPT 訂閱的 GPT-5.6 Sol High，預填使用者輸入與必要工作台 context。V1 不使用 Work 或 OpenAI API。

## 最小可驗證切片

1. Today 精簡入口與 AI 對話頁共用 browser handoff URL builder。
2. 使用者按「在 ChatGPT 開啟」後，新分頁必須是一般對話並保留工作台頁面。
3. 提示只能包含使用者明確輸入或選取的資料，不得自動載入整個資料庫。
4. ChatGPT 只產生 Task 草稿或修改建議；任何工作台資料變更仍由使用者在工作台確認執行。
5. 新分頁遭阻擋時顯示直接連結；ChatGPT 不可達時 Task、Board、Today 仍可用。

## 驗證

- Unit：URL 固定使用 `chatgpt.com` 一般對話模式、提示正確編碼且不含 Work/API 參數。
- Browser E2E：新分頁、預填內容、popup blocked fallback、mobile layout 與 failure isolation。
- Production smoke：使用指定帳號確認一般「對話」與 High；不自動送出測試訊息。

## 成本邊界

使用既有 ChatGPT 訂閱的一般對話額度，不新增 API 費用。不得切換 Work、購買 credits、升級方案或啟用付費 API。
