# AI Chat & Summary

## AI 使用方式

V1 使用使用者現有 ChatGPT 訂閱方案，不使用 OpenAI API。

工作台的 AI 入口必須以瀏覽器開啟 ChatGPT 一般「對話」頁，並預填工作台整理出的提示文字。

目標設定：

- ChatGPT 一般對話
- GPT-5.6 Sol
- High reasoning

禁止：

- 自動切換至 Work
- 使用 Work 對話處理 V1 日常 AI 對話
- 要求或儲存 OpenAI API key
- 呼叫按 token 計費的 OpenAI API
- 以 Extra High / xhigh 取代 High

模型與 reasoning 由 ChatGPT 帳號及網頁介面控制。工作台必須提示使用者確認顯示為 High；不得聲稱能透過 URL 強制選定模型。

## Browser Handoff

工作台提供瀏覽器入口，開啟 `chatgpt.com` 一般對話頁並預填內容。

基於瀏覽器同源與 ChatGPT 頁面安全限制：

- 不在 GitHub Pages 內以 iframe 嵌入 ChatGPT
- 不讀取 ChatGPT 頁面內容、登入狀態或對話結果
- 不代替使用者按下送出
- 使用者在 ChatGPT 頁面確認 High 後送出

若瀏覽器阻擋新分頁，工作台必須顯示可操作的重試或直接連結。

## Chat UI

兩個入口：

### 今日

精簡入口，適合快問或產生 Task 草稿。

### AI 對話

完整入口，允許使用者補充提示內容後開啟 ChatGPT 一般對話頁。

ChatGPT conversation history 由 ChatGPT 保存與搜尋。V1 不在 Supabase 複製 ChatGPT 完整對話，也不把 ChatGPT 對話描述成工作台內建歷史。

## 可交給 ChatGPT 的資料

只有使用者從工作台畫面明確選取或目前正在查看的資料，才可加入預填提示，例如：

- Task 基本欄位
- Checklist
- Activity / Notes
- Calendar relation
- 既有 AI Summary

不得自動將整個資料庫、其他 Task 或私人附件內容放入 ChatGPT 網址或提示。

## AI Task Actions

ChatGPT 在 V1 只產生建議或結構化 Task 草稿，不可直接操作 PersonalWorkStation 資料庫。

新增、修改、刪除 Task 或 Calendar relation 都必須回到工作台，由使用者確認並執行。

V1 不宣稱具備 ChatGPT 網頁與工作台之間的自動雙向同步。

## Cross-chat Retrieval

V1 不建立自動長期記憶。

過去 ChatGPT conversation 由使用者在 ChatGPT 介面搜尋；工作台只搜尋自身保存的 Task、Notes、Calendar relation 與 Summary。

## @AI Summary

Task Activity 支援 `@AI` 瀏覽器 handoff。

工作台將目前 Task 的必要內容整理成提示，開啟 ChatGPT 一般對話頁。使用者取得結果後，回到工作台建立 Summary Card。

整理結果不得直接覆寫原 Task。只有使用者明確建立待辦時才建立 Task。

## Summary Title

Summary 標題必須：

- 人類可讀
- 有具體意義

禁止只使用「摘要」、「進度整理」、「工作摘要」等空泛標題。

## Summary Relations

Summary ↔ Source Task 必須雙向連結。

## Version

允許多份，不覆蓋。

格式：`v.YY.MM.DD.HHmm`。

同分鐘重複使用 `-2 / -3`；內部仍使用 UUID。

## 新版本規則

舊 Summary 的 Description 第一行增加最新版本連結。

新 Summary 最上方先列：

- 與上一版不同的決策
- 已完成
- 已取消
- 已取代

再顯示完整摘要。

## Timeline

Summary 版本鏈使用時間軸，不使用 v1 / v2 / v3。
