# API 接線紀錄

根據使用者提供的 Network 資料：

| 功能 | POST URL | Body |
| --- | --- | --- |
| getCollection | https://www.plurk.com/EmoticonManager/getUserEmoticons | FormData：token |
| upload | https://www.plurk.com/EmoticonManager/uploadEmoFromFile | FormData：image（檔案）、token |
| add | https://www.plurk.com/Emoticons/add | URLSearchParams：token、hash_id、keyword、group_id |

前兩項依 WebKitFormBoundary 原始 Body 確認 multipart；第三項依 token=...&hash_id=...&keyword=&group_id=50 原始 Body 採 application/x-www-form-urlencoded。Content-Type 都交由瀏覽器依 Body 類型產生。JSON 是回應格式；不將先前未區分 Request/Response 的 application/json 記錄套到請求。

先前將 plurktokena Cookie 作為 token 遭伺服器以 Invalid form token 拒絕，已移除此做法與 cookies 權限。背景改以 scripting.executeScript 在目前分頁主框架的 MAIN world 按需讀取 GLOBAL.session_user.token，並直接交背景呼叫 API，不透過 DOM 或傳回 content script。權限為 scripting 與 https://www.plurk.com/*。無痕模式暫不支援。專案維護者已確認此表單 token 與背景請求在噗浪實際環境中驗證通過。

背景只接受本擴充功能於同站 /EmoticonManager2 管理文件送出的固定 action；不允許呼叫者提供 URL 或任意標頭。檔案以 Base64 通過 Chrome 訊息，背景還原成 Blob/FormData。fetch 使用 credentials:include、禁止重新導向，25 秒中止；逾時屬 unknown，不能推定修改失敗。

## 回應與佇列

getCollection 只回傳 go、g 和數字群組陣列的已知欄位，避免把任意伺服器內容傳回頁面。群組順序優先 go，再補 g 與數字群組；保留空群組、缺縮圖顯示佔位。縮圖僅允許 HTTPS。

upload 必須 ok===true 且 hash_id 非空；add 必須 ok===true 且 keyword 為字串，最終關鍵字採伺服器值。HTTP 200 不代表流程成功。已確認 ok:false 為 failed；斷線、無法解析、5xx 或格式不完整為 unknown。401／403／429 立即停止；Retry-After 只提示與暫時冷卻，不自動重試。

佇列仍使用 getCollection/upload/add 三個方法。保留 hash_id 供確認失敗後手動重做 add；不明 add 先讀收藏，以指定群組和 hash 核對。所有結果暫存在 iframe 記憶體，不宣稱跨重開可恢復。

## 實際環境驗證

依專案維護者確認，以下項目已在噗浪實際環境中驗證通過，與 README 的驗證狀態一致：

- 主頁表單 token 驗證，以及伺服器接受擴充功能背景請求。
- 單張與連續多張圖片的完整上傳流程，以及空白關鍵字的自動命名結果。
- 群組讀取與刷新、空群組回應，以及原生管理視窗整合與重開。
- 圖片大小、尺寸、格式與關鍵字限制，以及額滿、權限與頻率限制的實際回應。
- 失敗重試、結果不明核對，以及中途關閉視窗的行為。

以上為維護者回報的人工驗證結果；本文件未列出各項測試的環境、具體限制數值或回應樣本，不據此宣稱所有帳號與圖片均可上傳。正常完成後重新讀取資料只更新擴充功能，不直接操作原生 JS 快取。

自動測試另使用合成 GLOBAL.session_user 與 mock fetch 執行注入函式，不擷取真實 Cookie，也不進行真實上傳，與上述人工驗證分開記錄。執行：`node --test tests/upload-core.test.js tests/background.test.js`。

權限依據：[Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)、[背景跨來源請求](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)。

