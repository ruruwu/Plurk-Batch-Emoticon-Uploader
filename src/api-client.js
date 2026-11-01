(() => {
  "use strict";
  async function request(action, data) {
    let response;
    try { response = await chrome.runtime.sendMessage({ type: "plurk-batch-api", action, data }); }
    catch {
      const error = new PlurkBatchCore.RequestFailure({ uncertain: true });
      error.code = "BACKGROUND_UNAVAILABLE";
      throw error;
    }
    if (response?.success !== true) {
      const error = new PlurkBatchCore.RequestFailure({ status: response?.status || 0, uncertain: response?.uncertain !== false });
      error.retryAfter = response?.retryAfter || 0;
      error.code = typeof response?.code === "string" && /^[A-Z_]+$/.test(response.code) ? response.code : "BACKGROUND_BAD_REPLY";
      throw error;
    }
    return response.data;
  }
  globalThis.PlurkBatchApi = {
    getCollection() { return request("getCollection"); },
    async upload(file) {
      let base64;
      try {
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } catch { throw new PlurkBatchCore.RequestFailure(); }
      return request("upload", { name: file.name, type: file.type, base64 });
    },
    add(data) { return request("add", data); }
  };
})();
