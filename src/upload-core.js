/* Network-independent domain logic. No endpoint, token or fetch assumptions. */
(() => {
  "use strict";
  const validId = value => /^(0|[1-9]\d*)$/.test(String(value)) && Number.isSafeInteger(Number(value));
  function parseCollection(data) {
    if (!data || typeof data !== "object" || Array.isArray(data) || data.ok === false) throw new Error("無效的表符資料");
    const ids = new Set();
    const addId = id => { if (validId(id)) ids.add(String(id)); };
    if (Array.isArray(data.go)) data.go.forEach(addId);
    const thumbnails = data.g && typeof data.g === "object" && !Array.isArray(data.g) ? data.g : {};
    Object.keys(thumbnails).forEach(addId);
    Object.keys(data).filter(id => validId(id) && Array.isArray(data[id])).forEach(addId);
    if (!ids.size) throw new Error("未取得可辨識的群組；請確認回應格式");
    return [...ids].map(id => {
      let thumbnail = null;
      try {
        const url = new URL(thumbnails[id]);
        if (url.protocol === "https:") thumbnail = url.href;
      } catch { /* missing thumbnail uses a placeholder */ }
      return { id: Number(id), thumbnail, emoticons: Array.isArray(data[id]) ? data[id] : [] };
    });
  }
  // Transport must distinguish a confirmed rejection from an uncertain outcome.
  // Never display raw server bodies/errors, which might contain credentials.
  class RequestFailure extends Error {
    constructor({ status = 0, uncertain = false } = {}) {
      super("請求未完成");
      this.status = status;
      this.uncertain = uncertain;
    }
  }
  class QueueStopped extends Error {}
  function createQueue(api, { intervalMs = 1000, delay = ms => new Promise(resolve => setTimeout(resolve, ms)), onChange = () => {} } = {}) {
    let running = false;
    let stopped = false;
    let requestCount = 0;
    const notify = item => onChange(item);
    const call = async (method, ...args) => {
      if (requestCount++) await delay(intervalMs);
      if (stopped && method !== "getCollection") throw new QueueStopped();
      return api[method](...args);
    };
    const failureInfo = error => {
      const known = error instanceof RequestFailure;
      const status = known ? error.status : 0;
      return { uncertain: !known || error.uncertain, fatal: [401, 403, 429].includes(status), status };
    };
    async function run(items, groupId) {
      if (running) throw new Error("佇列執行中");
      if (!validId(groupId)) throw new Error("請選擇有效群組");
      if (!Array.isArray(items) || !items.length || items.some(item => !item.file || typeof item.keyword !== "string")) throw new Error("無效的待上傳資料");
      if (items.some(item => item.status === "unknown")) throw new Error("有結果不明的項目，請先確認伺服器資料");
      running = true;
      stopped = false;
      requestCount = 0;
      let suppressSync = false;
      let syncError = false;
      let collection = null;
      // Freeze order and user settings for the whole run.
      const plan = items.map(item => ({ item, keyword: item.keyword, groupId: Number(groupId) }));
      try {
        for (const task of plan) {
          const { item, keyword, groupId: target } = task;
          if (stopped) break;
          if (item.status === "success") continue;
          // A retained upload belongs to its originally selected group.
          if (item.hash_id && item.group_id !== undefined && item.group_id !== target) throw new Error("已上傳項目不可變更目標群組");
          item.group_id = target;
          item.error = "";
          let stage = "upload";
          try {
            if (!item.hash_id) {
              item.status = "uploading"; notify(item);
              const result = await call("upload", item.file);
              if (result?.ok !== true) throw new RequestFailure({ uncertain: result?.ok !== false });
              if (typeof result.hash_id !== "string" || !result.hash_id.trim()) throw new RequestFailure({ uncertain: true });
              item.hash_id = result.hash_id;
              item.url = typeof result.url === "string" ? result.url : "";
              item.status = "uploaded"; notify(item);
            }
            if (stopped) break;
            stage = "add";
            item.status = "adding"; notify(item);
            const result = await call("add", { hash_id: item.hash_id, keyword, group_id: target });
            if (result?.ok !== true) throw new RequestFailure({ uncertain: result?.ok !== false });
            if (typeof result.keyword !== "string") throw new RequestFailure({ uncertain: true });
            item.actualKeyword = result.keyword;
            item.status = "success"; notify(item);
          } catch (error) {
            if (error instanceof QueueStopped) {
              item.status = item.hash_id ? "uploaded" : "pending";
              notify(item);
              break;
            }
            const info = failureInfo(error);
            item.status = info.uncertain ? "unknown" : "failed";
            item.error = info.status === 429 ? "操作太頻繁了，上傳已停止，請等一下再試。" :
              [401, 403].includes(info.status) ? "現在無法繼續上傳，請確認已登入噗浪，而且帳號可以新增表符。" :
              info.uncertain ? "還不確定這張表符是否新增成功。請先到表符管理查看，避免重複上傳。" : "這張表符沒能新增。請先到表符管理確認是否還能新增，以及所選群組是否可用。";
            if (info.status === 429 && error.retryAfter > 0) item.error = `操作太頻繁了，上傳已停止。請至少等 ${error.retryAfter} 秒再試。`;
            if (info.fatal) { stopped = true; suppressSync = true; }
            if (info.uncertain) {
              // Never repeat a mutation after a timeout. Read once to reconcile.
              if (stage === "add" && !info.fatal) {
                try {
                  collection = await call("getCollection");
                  const group = parseCollection(collection).find(group => group.id === target);
                  const found = group?.emoticons.find(emo => emo.hash_id === item.hash_id);
                  if (found && typeof found.keyword === "string") {
                    item.actualKeyword = found.keyword;
                    item.status = "success";
                    item.error = "";
                  }
                } catch (readError) {
                  const readInfo = failureInfo(readError);
                  suppressSync = true; syncError = true;
                  if (readInfo.fatal) stopped = true;
                }
              }
              if (item.status === "unknown") stopped = true;
            }
            notify(item);
          }
        }
        if (!suppressSync) {
          try { collection = await call("getCollection"); parseCollection(collection); }
          catch { syncError = true; }
        }
        return { stopped, syncError, collection, items };
      } finally { running = false; }
    }
    return { run, stop() { stopped = true; }, get running() { return running; } };
  }
  const core = { parseCollection, RequestFailure, createQueue };
  globalThis.PlurkBatchCore = core;
  if (typeof module !== "undefined") module.exports = core;
})();
