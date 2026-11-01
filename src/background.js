"use strict";
const ORIGIN = "https://www.plurk.com";
const paths = {
  getCollection: "/EmoticonManager/getUserEmoticons",
  upload: "/EmoticonManager/uploadEmoFromFile",
  add: "/Emoticons/add"
};
const cooldowns = new Map();
function failure(status = 0, uncertain = false, retryAfter = 0, code = "REQUEST_FAILED") {
  return { success: false, status, uncertain, retryAfter, code };
}
async function handle(message, sender) {
  let url;
  try { url = new URL(sender.url); } catch { return failure(403); }
  if (sender.id !== chrome.runtime.id || !Number.isInteger(sender.tab?.id) ||
      sender.tab.incognito ||
      url.origin !== ORIGIN || !/^\/EmoticonManager2\/?$/.test(url.pathname) ||
      !Object.hasOwn(paths, message.action)) return failure(403);
  const until = cooldowns.get(sender.tab.id) || 0;
  if (until > Date.now()) return failure(429, false, Math.ceil((until - Date.now()) / 1000));
  // Read only the observed form-token candidate from the originating tab's
  // main page. Return directly to the worker, never via DOM events or logs.
  let token;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: [0] }, world: "MAIN",
      func: () => {
        if (location.origin !== "https://www.plurk.com") return null;
        if (typeof GLOBAL === "undefined") return null;
        const value = GLOBAL.session_user?.token;
        return typeof value === "string" && value.length ? value : null;
      }
    });
    token = results[0]?.result;
  } catch { return failure(403, false, 0, "SESSION_ACCESS_FAILED"); }
  if (typeof token !== "string" || !token.length) return failure(401, false, 0, "SESSION_TOKEN_MISSING");
  let body;
  if (message.action === "add") {
    const data = message.data;
    if (!data || typeof data.hash_id !== "string" || !data.hash_id.trim() ||
        typeof data.keyword !== "string" || !Number.isSafeInteger(data.group_id) || data.group_id < 0) return failure(400);
    body = new URLSearchParams({ token, hash_id: data.hash_id, keyword: data.keyword, group_id: String(data.group_id) });
  } else {
    body = new FormData();
    body.append("token", token);
    if (message.action === "upload") {
      const data = message.data;
      if (!data || typeof data.base64 !== "string" || !data.base64.length || typeof data.name !== "string" ||
          typeof data.type !== "string" || !data.type.startsWith("image/")) return failure(400);
      let binary;
      try { binary = atob(data.base64); } catch { return failure(400); }
      const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
      body.append("image", new Blob([bytes], { type: data.type }), data.name);
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(ORIGIN + paths[message.action], {
      method: "POST", body, credentials: "include", cache: "no-store",
      redirect: "error", signal: controller.signal
    });
    if (!response.ok) {
      let retryAfter = 0;
      if (response.status === 429) {
        const value = response.headers.get("Retry-After");
        retryAfter = value && /^\d+$/.test(value) ? Number(value) :
          value ? Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 1000)) : 0;
        if (!Number.isFinite(retryAfter)) retryAfter = 0;
        if (retryAfter) cooldowns.set(sender.tab.id, Date.now() + retryAfter * 1000);
      }
      return failure(response.status, response.status >= 500 || response.status === 408, retryAfter, "HTTP_ERROR");
    }
    let result;
    try { result = await response.json(); }
    catch { return failure(response.status || 200, true, 0, "RESPONSE_NOT_JSON"); }
    // Return only the allowlisted response schema, never an arbitrary server body.
    if (message.action === "getCollection") {
      if (result?.ok === false) return failure(response.status || 200, false, 0, "SERVER_REJECTED");
      if (!result || typeof result !== "object" || Array.isArray(result)) return failure(response.status || 200, false, 0, "COLLECTION_SHAPE");
      const clean = { go: Array.isArray(result.go) ? result.go.filter(id => /^\d+$/.test(String(id))) : [], g: {} };
      if (result.g && typeof result.g === "object") for (const [id, value] of Object.entries(result.g)) {
        if (/^\d+$/.test(id) && typeof value === "string" && value.startsWith("https://")) clean.g[id] = value;
      }
      for (const [id, rows] of Object.entries(result)) {
        if (/^\d+$/.test(id) && Array.isArray(rows)) clean[id] = rows.map(row => ({
          hash_id: typeof row?.hash_id === "string" ? row.hash_id : "",
          keyword: typeof row?.keyword === "string" ? row.keyword : "",
          url: typeof row?.url === "string" ? row.url : ""
        }));
      }
      if (!clean.go.length && !Object.keys(clean.g).length && !Object.keys(clean).some(id => /^\d+$/.test(id))) {
        return failure(response.status || 200, false, 0, "COLLECTION_NO_GROUPS");
      }
      return { success: true, data: clean };
    }
    if (result?.ok === false) return failure(0, false);
    if (result?.ok !== true) return failure(0, true);
    if (message.action === "upload") {
      if (typeof result.hash_id !== "string" || !result.hash_id.trim()) return failure(0, true);
      return { success: true, data: { ok: true, hash_id: result.hash_id, url: typeof result.url === "string" ? result.url : "" } };
    }
    if (typeof result.keyword !== "string") return failure(0, true);
    return { success: true, data: { ok: true, keyword: result.keyword } };
  } catch { return failure(0, true, 0, controller.signal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_OR_REDIRECT"); }
  finally { clearTimeout(timer); }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "plurk-batch-api") return false;
  handle(message, sender).then(respond, () => respond(failure(0, true, 0, "BACKGROUND_ERROR")));
  return true;
});
