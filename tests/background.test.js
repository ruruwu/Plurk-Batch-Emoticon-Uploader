"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function setup(fetchImpl, token = "synthetic-test-value") {
  let listener; let sessionReads = 0;
  const context = {
    URL, URLSearchParams, FormData, Blob, Uint8Array, atob, AbortController, setTimeout, clearTimeout,
    chrome: {
      runtime: { id: "test-extension", onMessage: { addListener(fn) { listener = fn; } } },
      scripting: {
        async executeScript(options) {
          sessionReads++;
          assert.equal(options.target.tabId, 1);
          assert.equal(options.target.frameIds[0], 0);
          assert.equal(options.world, "MAIN");
          const result = vm.runInNewContext(`(${options.func.toString()})()`, {
            location: { origin: "https://www.plurk.com" }, GLOBAL: { session_user: { token } }
          });
          return [{ result }];
        }
      }
    }, fetch: fetchImpl
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../src/background.js"), "utf8"), context);
  const sender = { id: "test-extension", tab: { id: 1, incognito: false }, url: "https://www.plurk.com/EmoticonManager2" };
  return { sender, get sessionReads() { return sessionReads; }, send(action, data, origin = sender) {
    return new Promise(resolve => listener({ type: "plurk-batch-api", action, data }, origin, resolve));
  } };
}
const response = data => ({ ok: true, async json() { return data; } });
test("collection uses POST multipart, background-only token, schema allowlist", async () => {
  const service = setup(async (url, options) => {
    assert.equal(url, "https://www.plurk.com/EmoticonManager/getUserEmoticons");
    assert.equal(options.method, "POST"); assert.equal(options.credentials, "include");
    assert.equal(options.headers, undefined);
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get("token"), "synthetic-test-value");
    return response({ go: [50], g: {}, "50": [], token: "must-not-return", extra: "must-not-return" });
  });
  const result = await service.send("getCollection");
  assert.equal(result.success, true);
  assert.equal(JSON.stringify(result).includes("token"), false);
  assert.equal(JSON.stringify(result).includes("must-not-return"), false);
});
test("upload reconstructs exact binary file and lets browser set multipart boundary", async () => {
  const service = setup(async (url, options) => {
    assert.ok(url.endsWith("/EmoticonManager/uploadEmoFromFile"));
    const file = options.body.get("image");
    assert.equal(file.name, "test.png"); assert.equal(file.type, "image/png");
    assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [0, 128, 255]);
    assert.equal(options.headers, undefined);
    return response({ ok: true, hash_id: "h", url: "https://emos.plurk.com/test.png", secret: "omit" });
  });
  const result = await service.send("upload", { base64: "AID/", name: "test.png", type: "image/png" });
  assert.equal(result.data.hash_id, "h"); assert.equal(result.data.secret, undefined);
});
test("add uses URLSearchParams and leaves keyword blank", async () => {
  const service = setup(async (url, options) => {
    assert.ok(url.endsWith("/Emoticons/add")); assert.ok(options.body instanceof URLSearchParams);
    assert.equal(options.body.get("keyword"), ""); assert.equal(options.body.get("group_id"), "50");
    assert.equal(options.body.get("hash_id"), "h");
    return response({ ok: true, keyword: "emo-server" });
  });
  const result = await service.send("add", { hash_id: "h", keyword: "", group_id: 50 });
  assert.equal(result.data.keyword, "emo-server");
});
test("rejects other senders, unknown actions and incognito before reading session", async () => {
  const service = setup(async () => assert.fail("must not fetch"));
  for (const sender of [{ ...service.sender, url: "https://evil.example/EmoticonManager2" }, { ...service.sender, id: "another" }, { ...service.sender, tab: { id: 1, incognito: true } }]) {
    assert.equal((await service.send("getCollection", undefined, sender)).status, 403);
  }
  assert.equal((await service.send("newGroup")).status, 403);
  assert.equal(service.sessionReads, 0);
});
test("missing session token stops before fetch", async () => {
  const service = setup(async () => assert.fail(), null);
  assert.equal((await service.send("getCollection")).status, 401);
});
test("429 cooldown blocks later requests and preserves Retry-After", async () => {
  let requests = 0;
  const service = setup(async () => { requests++; return { ok: false, status: 429, headers: { get() { return "60"; } } }; });
  assert.equal((await service.send("getCollection")).retryAfter, 60);
  assert.equal((await service.send("getCollection")).status, 429);
  assert.equal(requests, 1);
});
test("network failure and unparseable response are unknown, no sensitive errors returned", async () => {
  for (const fetcher of [async () => { throw new Error("private value"); }, async () => ({ ok: true, async json() { throw new Error("private value"); } })]) {
    const result = await setup(fetcher).send("getCollection");
    assert.equal(result.uncertain, true); assert.equal(JSON.stringify(result).includes("private"), false);
  }
});
test("collection diagnostics distinguish server rejection, non-JSON and absent groups", async () => {
  const cases = [
    [async () => response({ ok: false, error: "private" }), "SERVER_REJECTED"],
    [async () => response({ unexpected: "private" }), "COLLECTION_NO_GROUPS"],
    [async () => response([]), "COLLECTION_SHAPE"],
    [async () => ({ ok: true, status: 200, async json() { throw Error("private"); } }), "RESPONSE_NOT_JSON"]
  ];
  for (const [fetcher, code] of cases) {
    const result = await setup(fetcher).send("getCollection");
    assert.equal(result.success, false); assert.equal(result.code, code);
    assert.equal(JSON.stringify(result).includes("private"), false);
  }
});
