# V1 授權與人工操作狀態

更新日期：2026-09-25

這份紀錄協助辨識目前哪些工作已可由既有授權完成、哪些需要本人操作，以及該操作會影響哪些 V1 驗收。它不代替產品 PRD 或執行規則。

## 2026-09-25 最新處理與最短人工驗收

- **正式站自動化瀏覽器**：先前對 `https://chevalier1216.github.io/PersonalWorkStation/` 的額外網域操作遭授權審查拒絕；本次沒有換工具繞過，也不重試。最快方式是本人於正式站完成下列 Issue #1/#2 的同一次驗收。若日後審查權限實際改變，再重新評估自動化。
- **Drive 資料夾**：已在指定[原始專案資料夾](https://drive.google.com/drive/folders/1GCgotx89aY6gRlt8mR7np9yDgE17FKYE)內建立 [Archive](https://drive.google.com/drive/folders/1KeuAJD5k2H_b1Co46kAdpaBWX8n2urLK)，並讀回確認父資料夾正確。對原始資料夾中的檔案，可直接在 Google Drive 選檔 →「整理」→「移動」→ 選 `Archive`。本次未移動任何既有檔案，因使用者尚未指定要封存的檔案。
- **工作台 Drive OAuth**：建立資料夾不會自動授權工作台存取它；目前沒有讀到指定帳號實際授予的 scopes，也未按下 Google Cloud Data Access 的儲存或替使用者同意 OAuth。若需要工作台自動封存，本人須先在 Google 帳號的[第三方連線管理](https://myaccount.google.com/connections)檢查 `Project WorkStation` 的 Calendar／Drive 權限；不足時再由工作台按「重新連結 Google Drive」，核對同意畫面的帳號與權限後本人同意。這是人工 blocker，狀態未變前不重試。`drive.file` 未必可存取由另一個 Connector 建立的 `Archive`；工作台自動封存仍維持未驗證，不能以資料夾建立代替。
- **一般 ChatGPT「對話」**：本次在一般「對話」送出兩次唯讀能力測試；第一次服務回報生成錯誤，第二次長時間無回覆後停止。對話頁沒有顯示 PersonalWorkStation 專用連線，repo 亦沒有供一般 ChatGPT 對話存取真實 Task 的 connector。未取得任何真實 Task 讀取或寫入證據，因此無法保證在 ChatGPT 應用程式的「對話」模式操作 V1。依使用者決定，工具內 ChatGPT 對話功能暫存，工作台的 ChatGPT 開啟／摘要交接入口停用；Task／Run 建立及手動 Summary 保留。停止在目前帳號繼續試相同對話流程。

### Issue #1 與 #2：同一次人工驗收（無須 Work 額度）

1. 以指定 Google 帳號打開[正式站](https://chevalier1216.github.io/PersonalWorkStation/)。若能登入且 Today、任務看板正常載入，Issue #2 的前端初始化可視為本次通過；若白屏或顯示 Supabase 設定錯誤，記錄畫面與時間。
2. 在 Today 的「自訂版面」將任一模組上移或下移，等待「已儲存」，重新整理並確認順序保持；再還原原順序。若保持且沒有 `today_preferences_module_order_check` 錯誤，Issue #1 的本次正式站驗收通過。

兩張 issue 已關閉，過去有 production 操作證據；此次缺的是**最新部署版本**的可見畫面複驗。上述兩步約在同一次登入完成，不需要重新跑 Codex／Work 或重新設定 GitHub Variables。若登入本身遇 Google 授權畫面，先按上一項方式由本人處理，不能把未登入當成 issue 回歸失敗。

## 已解除的 GitHub 發布阻擋

GitHub CLI 的預設登入回傳 HTTP 401，但本機既有 Git Credential Manager 憑證仍有此 repository 的 workflow 權限。2026-09-25 使用該既有憑證暫時觸發 Pages，工作流程 `36078527439` 已將 commit `3b09f2bdc12862cf67f63a9c2f032b55a63ad8ba` 成功部署。設定檢查、建置、上傳與部署全數成功；未重新登入、要求驗證碼或建立新憑證。

這解決了本次發布；GitHub CLI 預設登入本身尚未修復。只要既有 Git 憑證可用，後續日常操作可沿用。若未來該憑證也失效，先記錄當次明確的錯誤，再由本人檢查目前 Codex GitHub Connector 或本機 Git 憑證授權；不反覆啟動瀏覽器登入或裝置驗證。

## 尚待人工授權或確認

### 正式站瀏覽器驗收

先前自動化瀏覽器存取 `https://chevalier1216.github.io/PersonalWorkStation/` 時，授權審查拒絕額外網域操作。此限制尚未解除，因此本次只確認 GitHub Pages 部署成功，沒有聲稱已在新版本重新驗證登入後畫面。

本人可在已開啟的正式站檢查登入、Today 排序儲存後重新整理、歷史搜尋與附件封存；若希望 Codex 代為操作，請明確授權 Codex 在上述正式站網址進行這些 V1 smoke test。待授權前，Codex 可繼續本機測試、修正與文件工作。

### Google Drive 封存授權

Google Calendar 既有授權不代表 Google Drive 附件封存也已授權。Drive 封存與維護的 production 寫入流程仍待驗證。若正式站顯示 Google Drive OAuth 同意畫面，需由本人核對畫面列出的權限與帳號後完成同意；Codex 會把該步驟記為人工阻擋，不重複嘗試。請勿在對話貼密碼、一次性驗證碼或 service role key。

2026-09-25 已在 Google Cloud Console 讀回目前狀態：project `project-workstation-509110` 的 Google Auth Platform → 資料存取權在非機密、機密、受限制三區均顯示「沒有可顯示的資料列」；目標對象仍是「外部／測試」，只有指定帳號 `racer831216@gmail.com` 一位測試使用者。Google Drive API 與 Google Calendar API 均顯示「API 已啟用」。前端登入／重新連結會要求 `calendar.calendarlist.readonly`、`calendar.events` 與 `drive.file`；尚未讀到指定帳號本次取得的實際授權範圍。

若正式站驗收仍顯示 Drive 授權不足，請依下列順序處理；已存在的設定無須重做：

1. 在 [Google Cloud Console 的資料存取權頁](https://console.cloud.google.com/auth/scopes?project=project-workstation-509110) 選定 `project-workstation-509110`，加入登入基本權限 `openid`、`userinfo.email`、`userinfo.profile` 與上述三項 Calendar／Drive 權限。Codex 已在頁面選好這六項，但因這會擴大應用程式對 Google 帳號的資料存取，目前停在尚未儲存的畫面等待明確確認。
2. 在 Google Auth Platform → Audience 維持目前唯一測試使用者，不把應用程式改成對外公開。
3. 由本人在正式站使用指定帳號按「重新連結」，核對 Google 同意畫面的帳號及所列 Calendar／Drive 權限後完成同意。這一步必須由帳號持有人操作；Codex 不索取密碼或驗證碼。
4. 返回工作台後再做一次小型附件的上傳、封存、重新開啟與失敗時原件保留測試。只有全部實測通過，才能把 Drive production 路徑改列為已驗證。

附件區與儲存維護頁現已提供「重新連結 Google Drive」入口；本機桌面／手機回歸測試驗證了入口與授權錯誤顯示，但它不能代替真實 Google 同意或 production 封存。若 Google 權杖到期，可由此入口重新授權。依 [Google OAuth 說明](https://developers.google.com/identity/protocols/oauth2)，外部／測試狀態下，要求 Calendar／Drive 等非基本身分權限的 refresh token 可能在七天後失效；[Supabase 文件](https://supabase.com/docs/guides/auth/social-login)也說明 Supabase 不會代替應用程式更新 Google provider token。目前程式未要求 Google offline access，因此需要把「重新連結」視為現階段恢復方法，不能宣稱已有長期自動續期。

Google 官方將 `drive.file` 定義為針對本應用建立或由使用者交給本應用的檔案權限；[權限說明](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)與 [Supabase Google 登入設定](https://supabase.com/docs/guides/auth/social-login/auth-google) 可供核對。依 [Google Drive API 用量與定價](https://developers.google.com/workspace/drive/api/guides/limits)，標準使用目前沒有額外費用，低於每日 400,000,000 quota units 門檻不計費；本專案只做小型 smoke，接近門檻或計費政策改變時必須先停下依 Cost Guardrail 告知。

### 工具內 ChatGPT 對話形式

原規格要求在工作台內使用一般 ChatGPT 網頁、以現有訂閱的 GPT-5.6 Sol High 對話，不消耗 Work 額度或透過付費 API。經本次有限實驗，尚無一般「對話」能操作真實工作台 Task 的證據；使用者已決定暫存此項目並停用入口。Windows 桌面外殼方案目前不再排入 V1 工作，除非日後明確重啟需求。

## 本次兩張 bug issue 的處理證據

- [Issue #1：Today 模組排序儲存](https://github.com/chevalier1216/PersonalWorkStation/issues/1)：正式 migration 已納入七個 V1 模組並保留舊版面可用；先前正式站已實測排序儲存與重新整理。2026-09-25 再跑資料庫定向測試 1/1、桌面／手機 Today E2E 4/4，全部通過。新部署版本的 production 畫面尚待上述瀏覽器驗收。
- [Issue #2：Pages 缺少 Supabase 設定](https://github.com/chevalier1216/PersonalWorkStation/issues/2)：Repository Actions variables `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY` 均存在；本次 Pages run `36078527439` 的設定檢查、Build、artifact 與 Deploy 全部成功。前端新版本的實際登入與 Supabase 初始化尚待上述瀏覽器驗收。

本次沒有啟用新付費 API、升級方案或建立計費資源。任何可能新增費用的後續操作仍需先依 `docs/product/08-EXECUTION-RULES.md` 的 Cost Guardrail 說明並取得明確授權。
