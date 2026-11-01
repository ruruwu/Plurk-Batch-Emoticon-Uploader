# 發布隱私權政策頁

政策正文只維護於 `docs/privacy.md`，根目錄 `PRIVACY.md` 為入口連結。

## 首次啟用

1. 將文件變更推送至 GitHub 的 `main` 分支；若分支名稱不同，請使用實際分支。
2. 到儲存庫 **Settings → Pages → Build and deployment**。
3. **Source** 選擇 **Deploy from a branch**。
4. **Branch** 選擇 `main`，資料夾選 `/docs`，按 **Save**。
5. 等待部署完成，以無痕視窗確認下列網址可以免登入閱讀完整政策。

Chrome Web Store 的 **Privacy policy URL** 欄位請填入：

```text
https://ruruwu.github.io/Plurk-Batch-Emoticon-Uploader/privacy.html
```

設定檔案不代表網站已經上線；請以 GitHub Pages 的部署結果及實際網址為準。

## 後續更新

修改 `docs/privacy.md` 的政策正文與更新日期，推送至發布分支後，GitHub Pages 會重新部署。商店後台的資料揭露也應與政策及程式行為保持一致。

此設定也會發布 `docs` 中未排除的既有文件，請只在這個目錄存放可公開資料。

官方說明：[GitHub Pages 發布來源設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
