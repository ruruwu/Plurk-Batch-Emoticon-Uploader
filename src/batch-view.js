(() => {
  "use strict";
  function create(doc, onBack, api = null) {
    const host = doc.createElement("div");
    host.dataset.plurkBatchOwned = "panel";
    host.hidden = true;
    const shadow = host.attachShadow({ mode: "open" });
    const style = doc.createElement("style");
    style.textContent = `:host{display:block;font:inherit;color:#555;height:100%;min-height:0;--blue:#45abe1;--red:#ff5353;--line:#e5e5ec}:host([hidden]){display:none}
      *{box-sizing:border-box}section{height:100%;min-height:0;display:flex;flex-direction:column;padding:16px;border:0;border-radius:10px;background:#eeeef4;color:#555}
      h3{margin:0;font-size:19px;color:#444}button,input,select{font:inherit}
      section>p:not(.status){color:#85858f;margin:6px 0 16px;line-height:1.6}
      button{cursor:pointer;padding:7px 15px;border:1px solid #dcdce5;border-radius:18px;background:#fff;color:#666;transition:background .15s,border-color .15s}
      button:hover:enabled{background:#f1f9fd;border-color:var(--blue)}button:disabled{cursor:default;opacity:.5}
      button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
      label{display:block;margin:8px 0;font-size:13px;color:#777}input[type=text],select{max-width:100%;padding:7px 9px;border:1px solid #dddde5;border-radius:5px;background:#f7f7f9;color:#444}
      .workspace{display:grid;grid-template-columns:minmax(230px,34%) minmax(0,1fr);gap:18px;flex:1;min-height:0}
      .step{min-width:0;min-height:0;display:flex;flex-direction:column;border:1px solid #e5e5ec;border-radius:10px;padding:16px;background:#fff}
      h4{font-size:14px;font-weight:600;color:#459fce;margin:0 0 12px;padding-bottom:12px;border-bottom:1px solid #eeeef4}.group-area{display:flex;flex-direction:column;min-height:0;flex:1}
      .group-area>button{align-self:flex-start;font-size:12px;margin:4px 0}
      .groups{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));align-content:start;gap:6px;overflow:auto;min-height:70px;margin-top:10px;flex:1}
      .groups button{display:grid;place-items:center;min-height:52px;padding:6px;border:2px solid transparent;border-radius:8px;background:#f6f6f9}
      .groups button[aria-pressed=true]{border-color:var(--blue);background:#eaf7ff}
      .groups img{width:32px;height:32px}.pick{margin:16px 0 0;padding-top:12px;border-top:1px solid var(--line)}.pick input{display:block;width:100%;margin-top:8px;font-size:12px}
      input::file-selector-button{font:inherit;color:#fff;background:var(--red);border:0;border-radius:18px;padding:7px 13px;margin-right:8px;cursor:pointer}
      .items{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(210px,100%),1fr));align-content:start;gap:8px;scrollbar-gutter:stable}
      article{position:relative;border:1px solid var(--line);border-radius:8px;background:#fff;padding:12px;min-width:0}img{display:block;object-fit:contain}
      article[data-state=success]{border-color:#b4dccb;background:#f7fcf9}article[data-state=failed],article[data-state=unknown]{border-color:#f0c0ba;background:#fff9f8}
      article button{font-size:12px;padding:4px 11px;margin-right:5px}article .result{color:#8b8b95;font-size:12px}article[data-state=success] .result{color:#368568}
      article .remove{position:absolute;top:6px;right:6px;width:28px;height:28px;padding:0;margin:0;border-radius:50%;font-size:20px;line-height:1;color:#999}
      article .remove:hover:enabled{color:var(--red);border-color:var(--red);background:#fff4f4}
      .preview{width:48px;height:48px;margin:0 auto 8px}.name{overflow-wrap:anywhere;font-size:12px}
      article p{overflow-wrap:anywhere}article input{width:100%}.empty{grid-column:1/-1;color:#777;text-align:center;padding:24px 8px}
      footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;flex-shrink:0}footer button{min-height:36px}
      footer .upload{margin-left:auto;background:var(--red);border-color:var(--red);color:#fff;padding:8px 26px;font-weight:600}
      footer .upload:hover:enabled{background:#f14747;border-color:#f14747}footer .upload:disabled{background:#d9d9e1;border-color:#d9d9e1;color:#fff;opacity:1}
      p{font-size:13px}.status{margin:12px 0 0;color:#82828d;line-height:1.5;flex-shrink:0}
      .groups,.items{scrollbar-width:thin;scrollbar-color:#c6c6d2 transparent}
      @media(max-width:560px){section{padding:10px}.workspace{grid-template-columns:minmax(0,1fr);overflow:auto}.step{min-height:280px}.items{min-height:220px}.groups{max-height:180px;flex:auto}.group-area{flex:auto}}
      `;
    shadow.append(style);
    const make = (tag, text, parent) => {
      const el = doc.createElement(tag);
      if (text) el.textContent = text;
      if (parent) parent.append(el);
      return el;
    };
    const section = make("section", "", shadow);
    make("h3", "批次上傳", section);
    make("p", api ? "選好群組和圖片，再調整上傳順序。關鍵字可以留空，讓噗浪自動命名。" : "這裡可以先選圖片看看效果，還不能上傳。", section);
    const workspace = make("div", "", section);
    workspace.className = "workspace";
    const step1 = make("div", "", workspace);
    step1.className = "step";
    make("h4", "步驟 1 · 選群組和圖片", step1);
    const groupArea = make("div", "", step1);
    groupArea.className = "group-area";
    make("p", "這批表符要加到哪個群組？點選下方圖示。", groupArea);
    const target = { value: "", disabled: true };
    const refresh = make("button", "重新整理群組", groupArea);
    refresh.type = "button";
    refresh.disabled = !api;
    const thumbnails = make("div", "", groupArea);
    thumbnails.className = "groups";
    const pickLabel = make("label", "選擇圖片（可多選） ", step1);
    pickLabel.className = "pick";
    const picker = make("input", "", pickLabel);
    picker.type = "file";
    picker.multiple = true;
    picker.accept = "image/*";
    const step2 = make("div", "", workspace);
    step2.className = "step";
    const previewHeading = make("h4", "步驟 2 · 確認圖片和順序（0 張）", step2);
    const items = make("div", "", step2);
    items.className = "items";
    make("p", "選好的圖片會出現在這裡，也可以調整上傳順序。", items).className = "empty";
    const status = make("p", "還沒選擇圖片。", section);
    status.className = "status";
    status.setAttribute("role", "status");
    const diagnostic = make("details", "", section);
    diagnostic.hidden = true;
    make("summary", "回報問題時，可以附上這些資訊", diagnostic);
    const diagnosticText = make("p", "", diagnostic);
    const footer = make("footer", "", section);
    const back = make("button", "回到表符管理", footer);
    back.type = "button";
    const upload = make("button", api ? "開始上傳" : "預覽模式，無法上傳", footer);
    upload.type = "button";
    upload.className = "upload";
    upload.disabled = true;
    let urls = [];
    let entries = [];
    let groups = [];
    let loading = false;
    let destroyed = false;
    let refreshNativeOnBack = false;
    const states = { pending: "等待上傳", uploading: "正在上傳圖片…", uploaded: "圖片已上傳，等待新增表符", adding: "正在新增表符…", success: "已新增", failed: "這張還沒完成", unknown: "還不確定是否新增成功" };
    const runner = api ? globalThis.PlurkBatchCore.createQueue(api, { onChange: () => render() }) : null;
    const updateControls = () => {
      const busy = !!runner?.running;
      picker.disabled = busy;
      target.disabled = busy || loading || !groups.length || entries.some(entry => entry.hash_id && entry.status !== "success");
      refresh.disabled = !api || busy || loading;
      back.disabled = busy;
      upload.disabled = !api || busy || loading || !groups.some(group => String(group.id) === target.value) || !entries.length || entries.some(entry => entry.status === "unknown") || entries.every(entry => entry.status === "success");
      if (busy) upload.disabled = true;
      for (const tile of thumbnails.querySelectorAll("button")) {
        tile.disabled = target.disabled;
        tile.setAttribute("aria-pressed", String(tile.dataset.groupId === target.value));
      }
    };
    function setCollection(data) {
      const parsed = globalThis.PlurkBatchCore.parseCollection(data);
      const previous = target.value;
      groups = [...parsed.filter(group => group.id === 1), ...parsed.filter(group => group.id !== 1)];
      thumbnails.replaceChildren();
      for (const group of groups) {
        const tile = make("button", "", thumbnails);
        tile.type = "button";
        tile.title = `群組 ${group.id}（${group.emoticons.length} 個表符）`;
        tile.dataset.groupId = String(group.id);
        tile.setAttribute("aria-label", tile.title);
        const icon = group.id === 1 ? "https://s.plurk.com/emoticon_manager/9d68041122e5e99c6235.png" :
          group.thumbnail || "https://s.plurk.com/emoticon_manager/79e02e926d2ce28fff7d.png";
        {
          const img = make("img", "", tile);
          img.width = 32;
          img.height = 32;
          img.alt = `群組 ${group.id}`;
          img.referrerPolicy = "no-referrer";
          img.addEventListener("error", () => { img.remove(); tile.textContent = `□ ${group.id}`; }, { once: true });
          img.src = icon;
        }
        tile.addEventListener("click", () => { if (!target.disabled) { target.value = String(group.id); updateControls(); } });
      }
      if (groups.some(group => String(group.id) === previous)) target.value = previous;
      else target.value = "";
      updateControls();
    }
    async function refreshGroups() {
      if (!api || loading || runner.running) return;
      loading = true; updateControls();
      diagnostic.hidden = true;
      diagnostic.open = false;
      try {
        const data = await api.getCollection();
        if (destroyed) return;
        try { setCollection(data); }
        catch {
          const error = new Error("群組格式無法辨識");
          error.code = "COLLECTION_PARSE";
          throw error;
        }
        status.textContent = "群組資料更新好了。";
      } catch (error) {
        if (!destroyed) {
          groups = []; target.value = ""; thumbnails.replaceChildren();
          status.textContent = error.status === 401 ? "無法確認你是否已登入。請重新登入噗浪，再開啟表符管理。" :
            error.status === 403 ? "讀取不到群組，請確認已允許擴充功能存取噗浪。如果正在使用無痕視窗，請換成一般視窗再試。" :
            error.status === 429 ? `操作太頻繁了${error.retryAfter ? `。請至少等 ${error.retryAfter} 秒再試。` : "，請等一下再試。"}` :
            "暫時讀取不到群組，請稍後點「重新整理群組」。";
          const code = typeof error.code === "string" && /^[A-Z_]+$/.test(error.code) ? error.code : "GROUP_READ_ERROR";
          diagnosticText.textContent = `［${code}${error.status ? `／HTTP ${error.status}` : ""}］`;
          diagnostic.hidden = false;
        }
      } finally { loading = false; if (!destroyed) updateControls(); }
    }
    refresh.addEventListener("click", refreshGroups);
    function render() {
      if (destroyed) return;
      items.replaceChildren();
      previewHeading.textContent = `步驟 2 · 確認圖片和順序（${entries.length} 張）`;
      if (!entries.length) make("p", "選好的圖片會出現在這裡，也可以調整上傳順序。", items).className = "empty";
      entries.forEach((entry, index) => {
        const row = make("article", "", items);
        row.dataset.state = entry.status;
        if (["pending", "failed", "unknown"].includes(entry.status)) {
          const remove = make("button", "×", row);
          remove.type = "button";
          remove.className = "remove";
          remove.title = "移除圖片";
          remove.setAttribute("aria-label", `移除 ${entry.file.name}`);
          remove.disabled = !!runner?.running;
          remove.addEventListener("click", () => {
            if (runner?.running || !["pending", "failed", "unknown"].includes(entry.status)) return;
            entries = entries.filter(item => item !== entry);
            URL.revokeObjectURL(entry.previewUrl);
            urls = urls.filter(url => url !== entry.previewUrl);
            if (!entries.length) picker.value = "";
            status.textContent = entries.length ? `目前有 ${entries.length} 張圖片。` : "還沒選擇圖片。";
            render();
          });
        }
        const preview = make("img", "", row);
        preview.className = "preview";
        preview.width = 48;
        preview.height = 48;
        preview.alt = entry.file.name;
        preview.src = entry.previewUrl;
        preview.addEventListener("error", () => { if (!entry.decodeError) { entry.decodeError = true; make("p", "這張圖片無法預覽，請確認檔案能正常開啟，或換一張圖片試試。", row); } }, { once: true });
        make("div", `${index + 1}. ${entry.file.name}`, row).className = "name";
        const keywordLabel = make("label", "關鍵字（可留空） ", row);
        const keyword = make("input", "", keywordLabel);
        keyword.type = "text"; keyword.value = entry.keyword;
        keyword.placeholder = "留空，讓噗浪自動命名";
        keyword.disabled = !!runner?.running || entry.status === "success" || entry.status === "unknown";
        keyword.addEventListener("input", () => { entry.keyword = keyword.value; });
        make("p", states[entry.status] + (entry.actualKeyword !== undefined ? `：${entry.actualKeyword}` : ""), row).className = "result";
        if (entry.error) make("p", entry.error, row);
        for (const [label, offset] of [["上移", -1], ["下移", 1]]) {
          const move = make("button", label, row);
          move.type = "button";
          move.disabled = !!runner?.running || index + offset < 0 || index + offset >= entries.length;
          move.addEventListener("click", () => { [entries[index], entries[index + offset]] = [entries[index + offset], entries[index]]; render(); });
        }
      });
      updateControls();
    }
    const clear = () => {
      refreshNativeOnBack = false;
      urls.forEach(url => URL.revokeObjectURL(url));
      urls = [];
      entries = [];
      items.replaceChildren();
      previewHeading.textContent = "步驟 2 · 確認圖片和順序（0 張）";
      make("p", "選好的圖片會出現在這裡，也可以調整上傳順序。", items).className = "empty";
      picker.value = "";
      status.textContent = "還沒選擇圖片。";
      updateControls();
    };
    picker.addEventListener("change", () => {
      if (runner?.running) return;
      const files = Array.from(picker.files || []);
      picker.value = "";
      if (!files.length) return;
      if (files.some(file => file.type.startsWith("image/"))) {
        const completedUrls = new Set(entries.filter(entry => entry.status === "success").map(entry => entry.previewUrl));
        completedUrls.forEach(url => URL.revokeObjectURL(url));
        urls = urls.filter(url => !completedUrls.has(url));
        entries = entries.filter(entry => entry.status !== "success");
      }
      let count = 0;
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        count++;
        const url = URL.createObjectURL(file);
        urls.push(url);
        entries.push({ file, keyword: "", previewUrl: url, status: "pending" });
      }
      status.textContent = `新增了 ${count} 張圖片，目前共 ${entries.length} 張。` + (files.length > count ? `有 ${files.length - count} 個檔案不是圖片，已略過。` : "");
      render();
    });
    upload.addEventListener("click", async () => {
      if (upload.disabled) return;
      try {
        const resultPromise = runner.run(entries, Number(target.value));
        render();
        const result = await resultPromise;
        if (destroyed) return;
        refreshNativeOnBack = !result.stopped &&
          (refreshNativeOnBack || entries.some(entry => entry.status === "success"));
        const completed = entries.every(entry => entry.status === "success");
        if (completed) target.value = "";
        if (result.collection && !result.syncError) setCollection(result.collection);
        status.textContent = `已新增 ${entries.filter(entry => entry.status === "success").length}/${entries.length} 個表符。` +
          (completed ? "這批都完成了！要上傳下一批，請重新選擇群組和圖片。" : "") +
          (!completed ? (result.stopped ? "上傳已停止，請查看各張圖片的提示。" : "請查看各張圖片的提示。") : "") + (result.syncError ? "暫時無法更新表符清單，請稍後點「重新整理群組」。" : "");
      } catch { if (!destroyed) status.textContent = "還不能開始上傳，請確認已選好群組，也看看各張圖片的提示。"; }
      finally { if (!destroyed) render(); }
    });
    back.addEventListener("click", () => {
      onBack(refreshNativeOnBack);
    });
    return { host, clear, setCollection,
      get needsNativeRefresh() { return refreshNativeOnBack && !runner?.running; },
      open() { if (api) void refreshGroups(); }, destroy() { destroyed = true; runner?.stop(); clear(); host.remove(); } };
  }
  globalThis.PlurkBatchView = { create };
})();


