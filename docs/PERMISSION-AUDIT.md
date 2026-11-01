# 上架前權限與風險審查

審查日期：2026-11-01。對象：1.0.0；靜態閱讀 manifest、全部七個 src 檔案、全部四個 tests 檔案、README 與 API-CONTRACT。專案沒有 popup、side panel、options page 或獨立 injected script；MAIN world 函式位於 background.js。此目錄沒有 Git metadata，以下 diff 依修改前讀取內容記錄。

原始靜態審查結論：B，建議完成揭露與人工驗證後上架。現有 API 權限均有用途；僅縮小 content script 路徑。當時未發現重大權限濫用，但真實登入 token 與上傳流程尚未實測。此結論保留為當時的審查紀錄。

最新驗證狀態：專案維護者已確認 README 所列的實際環境驗證項目全部通過，包括 token 與背景請求、完整上傳、群組操作、限制回應、失敗重試、結果不明核對及中途關閉視窗行為。下方保留原始靜態審查及檢查清單；這項功能驗證更新不等於 Chrome Web Store 已審核通過。

## Permission Audit

| Permission / Host | 實際用途與使用位置 | 是否必要／移除影響 | 是否過大 | 建議分類 |
| --- | --- | --- | --- | --- |
| permissions: scripting | src/background.js handle → chrome.scripting.executeScript；在發訊分頁 frame 0 的 MAIN world 讀 GLOBAL.session_user.token | 必要；移除會令群組讀取、圖片上傳、加入收藏全部無法取得表單 token | 無明顯過大；target 指定 tabId、frameIds:[0]，函式來源為封裝程式碼 | 必須保留 |
| host_permissions: https://www.plurk.com/* | background.js handle → executeScript 主頁取 token、fetch 三個固定同站端點 | 必要；移除會破壞主頁注入及背景跨來源請求 | 精確 HTTPS 主機，沒有子網域 wildcard；host permission 的 path 被 Chrome 忽略，不能用 API 路徑實質縮權 | 必須保留 |
| content_scripts.matches: https://www.plurk.com/EmoticonManager2*（原） | manifest 載入六個本地腳本；content.js 路徑檢查後啟動整合 | 管理頁需要；原設定會先載入腳本到同前綴不支援路徑，即使 content.js 最後不啟動 | 是，允許任意後綴 | 可以縮小；已改為下列四項 |
| https://www.plurk.com/EmoticonManager2 | content.js、integration.js start、plurk-adapter.js resolve | 精確管理頁需要 | 否 | 必須保留 |
| https://www.plurk.com/EmoticonManager2?* | 同上；保留管理頁 query string | 保留原有管理頁查詢參數相容性；* 只在問號後 | 否 | 必須保留 |
| https://www.plurk.com/EmoticonManager2/ | 同上；content.js 允許尾斜線 | 保留既有路徑契約 | 否 | 必須保留 |
| https://www.plurk.com/EmoticonManager2/?* | 同上；尾斜線與 query string | 保留既有路徑契約 | 否 | 必須保留 |
| content_scripts.all_frames: true | 原生管理頁位於主站 iframe；每個 frame 仍需符合 matches | 必要；false 會漏掉核心 iframe | 否；不是所有主站 frame 都會注入 | 必須保留 |
| optional_permissions / optional_host_permissions | 未宣告、沒有 permissions.request | 無可移除項 | 不適用 | 維持未宣告 |
| externally_connectable | 未宣告；沒有 onMessageExternal | 沒有網頁外部訊息入口設定 | 不適用 | 維持未宣告 |
| web_accessible_resources | 未宣告；沒有對網頁公開封裝資源的需要 | 無可移除項 | 不適用 | 維持未宣告 |

沒有找到宣告但完全未使用的 permission，也沒有重複的 permission。content_scripts 的管理文件存取不能取代主頁 MAIN world 存取與背景 fetch 所需的 host_permissions。

activeTab 不是現有流程的替代方案：點網站內的批次按鈕不構成 Chrome action 等授予 activeTab 的操作；專案沒有相關 action 入口。改用它需要重設操作流程，超出本次範圍。scripting 此處用於讀取 token，不是安裝後補注入。

## 實際能力與資料流

| 類別 | 證據及行為 |
| --- | --- |
| Chrome API | api-client.js request 使用 runtime.sendMessage；background.js 使用 runtime.id、runtime.onMessage 和 scripting.executeScript。runtime 訊息不另需 tabs/storage 權限；tabId 來自 sender.tab.id，沒有 tabs.query。 |
| DOM 讀取 | plurk-adapter.js findRoots/resolve 讀管理頁節點、尺寸與 computed style；integration.js 觀察 childList；batch-view.js 讀使用者選圖、群組及關鍵字。 |
| DOM 修改 | integration.js 加入批次按鈕及面板，暫時隱藏原生區塊並還原；batch-view.js 在 Shadow DOM 建立預覽及狀態；adapter 設定樣式。這些不等於伺服器修改。 |
| Script injection | background.js executeScript 的封裝函式在 MAIN world 按需讀 session_user.token；一般 UI 腳本為預設 isolated world，沒有遠端 JS 或 DOM script tag 注入。 |
| 網路讀取 | background.js POST /EmoticonManager/getUserEmoticons，含 token，取群組、縮圖及收藏 hash/keyword/url。POST 不必然是 mutation；此 action 依既有 API 契約為讀取。 |
| 伺服器修改 | background.js POST /EmoticonManager/uploadEmoFromFile 上傳圖片（含檔名、MIME、token），POST /Emoticons/add 提交 hash_id、keyword、group_id、token，修改使用者收藏。batch-view.js 只在「開始上傳」觸發 queue.run；upload-core.js 逐張 upload/add。 |
| Blob / FormData | api-client.js FileReader 將所選檔案轉 Base64，背景還原 Blob、FormData；add 使用 URLSearchParams。沒有 downloads API 或下載功能。 |
| 預覽 | batch-view.js createObjectURL(file)，clear/destroy/reselect 時 revokeObjectURL；預覽不會上傳選圖，開始上傳才送出檔案。 |
| 暫存 | 檔案、群組、關鍵字、hash 與結果存在 iframe 記憶體；background.js cooldowns 為 worker 記憶體 Map。token 為每次 handle 區域變數，不記錄或持久化，也不直接回傳 content script。 |
| 未發現 | browser.*、XMLHttpRequest、WebSocket、clipboard 讀寫、localStorage、sessionStorage、IndexedDB、chrome.storage、Cookie API、history、OAuth/identity、PUT/PATCH/DELETE、eval、new Function、innerHTML 寫入、混淆程式、analytics、telemetry、crash reporting、tracking SDK。 |

**有 server-side 資料修改**：上傳表符與加入收藏是產品核心功能。未發現發文、回覆、編輯貼文、刪除資料、修改帳號設定、群組新增或刪除。沒有新增 mutation；本次僅修改 manifest 路徑。

**有對外資料傳輸**：使用者所選圖片、檔名、關鍵字、群組、hash 與 token 會傳到噗浪。若以相對於擴充功能開發者的第三方定義，噗浪也是第三方服務；不能寫成「沒有第三方資料傳輸」。未發現傳至開發者伺服器或 AI 服務。

沒有直接讀取 Cookie，但 fetch 的 credentials:include 會讓瀏覽器依規則附帶目標站 Cookie。讀取的是頁面表單 token，沒有 OAuth token 存取證據，仍須作為敏感驗證資料說明。

## 所有外部 domain

| 主機 | 用途／傳輸 | 需 host permission？ |
| --- | --- | --- |
| www.plurk.com | 背景三個固定 HTTPS POST 端點；亦為管理頁及 token 主頁 | 是，已精確宣告 |
| s.plurk.com | batch-view.js setCollection 的兩張固定群組／佔位圖，以 img.src 載入；可能傳送 IP、一般請求資訊及瀏覽器允許的 Cookie | 否；普通圖片顯示不需擴充功能跨來源 fetch 權限，更不需 content script 注入 |
| API 回傳 thumbnail 的任意 HTTPS 主機 | background.js clean.g、upload-core.js parseCollection 只驗 HTTPS；batch-view.js img.src 實際載入，設定 no-referrer；伺服器可能回傳其他主機，靜態分析不能列出完整動態集合 | 否；保留既有圖片流程，需人工觀察實際 Network 主機 |
| emos.plurk.com | 測試中的合成圖片 URL 範例；不代表已確認正式環境使用此主機 | 不新增權限 |

tests 的 evil.example 僅為拒絕來源測試；javascript:alert(1) 為縮圖過濾測試，不是執行行為。文件中的 Chrome 文件連結也不會被 extension 自動請求。

## 敏感權限與安裝警告

目前僅宣告 scripting。預期可能出現「讀取及變更 www.plurk.com 上的資料」類網站存取警告，來自 host_permissions 以及同站 content_scripts.matches；Chrome 可能合併顯示。使用者可能理解為可讀寫整個主站資料，不能宣稱權限只允許三個 API。scripting 配合主站權限確實可執行主頁程式；通常不另顯示獨立 scripting 警告，實際文字、合併與顯示時機由 Chrome 版本、語言、安裝方式及網站權限設定決定。縮小注入路徑不保證減少安裝警告。

以下皆未宣告，也未發現相應用途，不應新增：tabs、activeTab、cookies、webRequest、webRequestBlocking、declarativeNetRequest、history、bookmarks、downloads、clipboardRead、clipboardWrite、notifications、identity、management、nativeMessaging、debugger、browsingData、geolocation。沒有剪貼簿原內容讀取、下載歷史讀取、瀏覽歷史存取。沒有 clipboard 或下載功能，因此無需替代實作。

## 最小 manifest diff

```diff
-    "matches": ["https://www.plurk.com/EmoticonManager2*"],
+    "matches": [
+      "https://www.plurk.com/EmoticonManager2",
+      "https://www.plurk.com/EmoticonManager2?*",
+      "https://www.plurk.com/EmoticonManager2/",
+      "https://www.plurk.com/EmoticonManager2/?*"
+    ],
```

刪除：沒有移除 API permission。縮小：排除 /EmoticonManager2Other、/EmoticonManager2/child 等 content.js 原本就拒絕啟動的路徑。保留：查詢參數、尾斜線、iframe、scripting、精確主站 host 權限。未修改 UI、文案、CSS、selector、parser、訊息、API payload、事件、錯誤或圖片流程。

## Chrome Web Store 風險

| 狀態 | 判斷與後續 |
| --- | --- |
| 🟢 無明顯風險 | 權限與批次表符上傳單一用途一致；沒有所有網站存取、無關子網域、背景排程爬取、遠端程式執行或追蹤套件。背景只處理固定 action，校驗 sender.id/tab/url、拒絕無痕，固定端點與 redirect:error，回應欄位過濾。 |
| 🟡 建議補充說明 | 上架說明及隱私揭露應包含主頁驗證 token 讀取、攜帶登入 Cookie、圖片／關鍵字送噗浪、群組收藏讀取、CDN／動態縮圖載入及僅記憶體保存。README 已有部分說明，但專案未提供正式隱私政策或商店資料，無法驗證其一致性。 |
| 🟡 建議補充說明 | 動態縮圖只限制 HTTPS，無 host allowlist。可能向噗浪回傳的其他圖床送出圖片請求；no-referrer 降低 referrer 洩漏，不能阻止主機看到 IP。保留相容性，不在本次任意修改圖片處理。 |
| 已由維護者確認通過 | 真實 token、背景請求來源與完整上傳流程已完成實際環境驗證，狀態已同步至 README/API-CONTRACT；此結果來自維護者的人工驗證，並非本機 mock 測試。 |

未發現須因重大權限濫用標為紅色的項目。商店表單、政策揭露與實機行為仍需核對；此審查不是商店通過保證。

## 原始靜態審查驗證記錄

- 已執行 node --test tests/upload-core.test.js tests/background.test.js：19/19 通過，使用合成 token 與 mock fetch，無真實上傳。
- 已檢查 JavaScript 語法、manifest JSON 及列出的本地腳本路徑。
- 原始靜態審查期間未在真實 Chrome 安裝、登入噗浪、讀取真實 token 或送出修改；fixture 瀏覽器檢查當時亦未執行。此處描述原始審查範圍，不代表目前功能仍未實測。

## 維護者補充的實際環境驗證

維護者已確認以下項目通過，與 README 及 API-CONTRACT 的紀錄一致：

- 主頁表單 token 驗證，以及噗浪接受擴充功能背景送出的請求。
- 單張與連續多張圖片的完整上傳流程，以及空白關鍵字的自動命名結果。
- 群組讀取與刷新、空群組回應，以及原生管理視窗整合與重開。
- 圖片大小、尺寸、格式與關鍵字限制，以及額滿、權限與頻率限制的實際回應。
- 失敗重試、結果不明核對，以及中途關閉視窗的行為。

本文件未附逐項環境與回應樣本。以下清單涵蓋額外的權限、商店揭露及回歸檢查，不因上述功能驗證通過而一併勾選。

## 上架前 Regression Checklist

以下保留原始上架前清單。未勾選表示本文件未記錄該完整檢查項目的逐項結果，不表示相關功能驗證失敗或尚未實測；已確認的功能範圍以上方「維護者補充的實際環境驗證」為準。涉及商店資料、安裝警告、Network 主機清單等額外項目，不推定為已通過。

- [ ] Chrome 全新安裝無 manifest 錯誤，service worker 可啟動及接收訊息；記錄實際網站存取警告。
- [ ] 一般視窗登入噗浪，開啟原生管理 iframe 的上傳分頁，批次按鈕僅一個。
- [ ] 管理頁無尾斜線、有尾斜線、含 query、含 fragment 的版本，確認 Chrome 實際匹配及功能。
- [ ] 一般主頁不載入六個 UI content scripts；其他網站、CDN、API 路徑、其他子網域、/EmoticonManager2Other 及子路徑不注入。注意主頁仍會在按需請求時執行 token 函式。
- [ ] 打開批次面板／手動重新整理可讀群組；空群組、群組 1 排序、圖示、缺圖及載入失敗可正常顯示。
- [ ] 多圖選取、非圖片略過、預覽、上下排序、群組選取、自訂／空白關鍵字均正常。
- [ ] 未按開始時無 upload/add；確認圖片僅作本地預覽。
- [ ] 使用測試帳號明確操作 1 張完整上傳，再測多張逐張順序及空白 keyword 的伺服器命名；核對原生收藏。
- [ ] 已確認 add 失敗後手動再開始會保留 hash、不重傳圖片；unknown 不盲目重送，以指定群組與 hash 核對。
- [ ] 401/403/429、Retry-After、斷線、逾時、錯誤格式與同步失敗顯示合理，沒有意外後續修改或敏感錯誤內容。
- [ ] 返回可還原原生區塊；重繪、切分頁、關閉重開沒有重複入口，重新選圖／返回會清草稿與釋放 object URL。
- [ ] 處理中關閉管理 iframe 的既有風險可重現並有說明：記憶體結果會遺失，已送出的 mutation 可能完成。
- [ ] reload extension 後，在已開主站重新開管理視窗並必要時重新整理頁面可恢復；沒有安裝後自動補注入機制，不應預期既有文件立即生效。
- [ ] 撤銷網站權限時合理失敗，恢復後正常；保留 scripting/host 權限時主頁 token 與背景 fetch 正常。沒有移除 permission，移除後測試不適用。
- [ ] Network 僅見三個固定 API、既有圖片主機；列出實際動態 thumbnail domain，確認沒有未知資料接收者。
- [ ] 縮小 content script 後跨來源群組圖片仍正常；不向 CDN 新增 host 或注入權限。
- [ ] 未新增 server-side mutation、clipboard read、持久化、未知請求；token 不出現在擴充功能日誌、診斷或回傳訊息。
- [ ] 無痕視窗被背景拒絕；一般視窗不受影響。
- [ ] tests/fixture.html 的生命週期按鈕與手動選圖預覽檢查通過。
- [ ] 商店單一用途、權限理由、隱私政策與資料處理表單和上述實際行為一致。

## 官方依據

- [Match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)：host permission path 被忽略，保留 /*。
- [scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)：需要 scripting 及目標 host 權限或有效 activeTab 授權。
- [背景跨來源請求](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)：背景 fetch 的 host 存取與 content script 注入分開審查。
- [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)：all_frames 仍依各 frame 的 URL 匹配。
- [Permission warning guidelines](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings)：警告反映授予能力，顯示可能合併。
