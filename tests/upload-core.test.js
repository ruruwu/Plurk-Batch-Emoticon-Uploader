"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseCollection, RequestFailure, createQueue } = require("../src/upload-core.js");
const item = (name = "a.gif") => ({ file: { name }, keyword: "", status: "pending" });
const collection = { go: [50], g: {}, "50": [] };
const queue = (api, extra = {}) => createQueue(api, { delay: async () => {}, ...extra });
test("groups follow go, retain empty groups, merge thumbnail and numeric keys", () => {
  const groups = parseCollection({ go: [50, 12, 50], g: { "24": "https://emos.plurk.com/a.gif", "50": "javascript:alert(1)" }, "12": [], "7": [], ok: true });
  assert.deepEqual(groups.map(g => g.id), [50, 12, 24, 7]);
  assert.equal(groups[0].thumbnail, null);
  assert.equal(groups[0].emoticons.length, 0);
  assert.throws(() => parseCollection({ ok: false }));
});
test("uploads and adds strictly sequentially, preserves blank keywords and server keyword", async () => {
  const calls = [];
  let active = false;
  const files = [item("a"), item("b")];
  const result = await queue({
    async upload(file) { assert.equal(active, false); active = true; calls.push(`upload:${file.name}`); await Promise.resolve(); active = false; return { ok: true, hash_id: file.name }; },
    async add(body) { calls.push(`add:${body.hash_id}`); assert.equal(body.keyword, ""); assert.equal(body.group_id, 50); return { ok: true, keyword: "server-" + body.hash_id }; },
    async getCollection() { calls.push("sync"); return collection; }
  }).run(files, 50);
  assert.deepEqual(calls, ["upload:a", "add:a", "upload:b", "add:b", "sync"]);
  assert.equal(files[0].actualKeyword, "server-a");
  assert.equal(result.syncError, false);
});
test("confirmed add failure retains hash and explicit rerun skips upload", async () => {
  const row = item(); let uploads = 0; let adds = 0;
  const runner = queue({
    async upload() { uploads++; return { ok: true, hash_id: "h" }; },
    async add() { return ++adds === 1 ? { ok: false } : { ok: true, keyword: "x" }; },
    async getCollection() { return collection; }
  });
  await runner.run([row], 50);
  assert.equal(row.status, "failed"); assert.equal(row.hash_id, "h");
  assert.equal(row.error, "這張表符沒能新增。請先到表符管理確認是否還能新增，以及所選群組是否可用。");
  await runner.run([row], 50);
  assert.equal(uploads, 1); assert.equal(row.status, "success");
});
test("unknown add reconciles by hash AND group without repeating add", async () => {
  const row = item(); let adds = 0;
  await queue({
    async upload() { return { ok: true, hash_id: "h" }; },
    async add() { adds++; throw new Error("sensitive raw server body"); },
    async getCollection() { return { go: [50], "50": [{ hash_id: "h", keyword: "actual" }] }; }
  }).run([row], 50);
  assert.equal(adds, 1); assert.equal(row.status, "success"); assert.equal(row.actualKeyword, "actual");
});
test("unknown add in different group stays unknown and blocks further mutations", async () => {
  const rows = [item(), item("b")]; let uploads = 0;
  const runner = queue({
    async upload() { uploads++; return { ok: true, hash_id: "h" }; },
    async add() { throw new Error("timeout"); },
    async getCollection() { return { go: [50, 12], "12": [{ hash_id: "h", keyword: "wrong" }] }; }
  });
  await runner.run(rows, 50);
  assert.equal(rows[0].status, "unknown"); assert.equal(uploads, 1);
  assert.equal(rows[0].error, "還不確定這張表符是否新增成功。請先到表符管理查看，避免重複上傳。");
  await assert.rejects(runner.run(rows, 50));
});
test("401, 403 and 429 stop ALL subsequent requests including sync", async () => {
  for (const status of [401, 403, 429]) {
    let calls = 0;
    const rows = [item(), item("b")];
    const result = await queue({
      async upload() { calls++; throw new RequestFailure({ status }); },
      async add() { assert.fail("must not add"); },
      async getCollection() { assert.fail("must not sync"); }
    }).run(rows, 50);
    assert.equal(calls, 1); assert.equal(result.stopped, true);
    assert.equal(rows[0].error, status === 429 ? "操作太頻繁了，上傳已停止，請等一下再試。" : "現在無法繼續上傳，請確認已登入噗浪，而且帳號可以新增表符。");
  }
});
test("malformed upload success is unknown and does not add", async () => {
  const row = item();
  await queue({ async upload() { return { ok: true, hash_id: " " }; }, async add() { assert.fail(); }, async getCollection() { return collection; } }).run([row], 50);
  assert.equal(row.status, "unknown");
});
test("stop during upload retains uploaded hash without adding", async () => {
  const row = item(); let runner;
  runner = queue({ async upload() { runner.stop(); return { ok: true, hash_id: "h" }; }, async add() { assert.fail(); }, async getCollection() { return collection; } });
  await runner.run([row], 50);
  assert.equal(row.status, "uploaded"); assert.equal(row.hash_id, "h");
});
test("double start rejected, sync failure does not erase success", async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const row = item();
  const runner = queue({ async upload() { await wait; return { ok: true, hash_id: "h" }; }, async add() { return { ok: true, keyword: "x" }; }, async getCollection() { throw new Error("network"); } });
  const first = runner.run([row], 50);
  await assert.rejects(runner.run([item()], 50));
  release(); const result = await first;
  assert.equal(row.status, "success"); assert.equal(result.syncError, true);
});
test("stopping in inter-request delay never sends the scheduled add", async () => {
  const row = item(); let runner;
  runner = queue({ async upload() { return { ok: true, hash_id: "h" }; }, async add() { assert.fail(); }, async getCollection() { return collection; } }, { delay: async () => { runner.stop(); } });
  await runner.run([row], 50);
  assert.equal(row.status, "uploaded");
});
test("missing ok is an unknown result, not a confirmed rejection", async () => {
  const row = item();
  await queue({ async upload() { return {}; }, async add() { assert.fail(); }, async getCollection() { return collection; } }).run([row], 50);
  assert.equal(row.status, "unknown");
});
