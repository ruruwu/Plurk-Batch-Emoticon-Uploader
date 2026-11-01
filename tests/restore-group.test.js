"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function fixture(saved) {
  let callback;
  let ready = false;
  let clicks = 0;
  let removed = 0;
  let disconnected = 0;
  const group = { click: () => clicks++ };
  const host = { querySelector: selector => ready &&
    (selector.includes("current") || selector.includes('"50"')) ? group : null };
  const doc = {
    documentElement: {},
    querySelector: () => host,
    defaultView: { sessionStorage: {
      getItem: () => JSON.stringify(saved), removeItem: () => removed++
    } }
  };
  const context = vm.createContext({
    Date, setTimeout: () => 1, clearTimeout() {},
    MutationObserver: class {
      constructor(fn) { callback = fn; }
      observe() {} disconnect() { disconnected++; }
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/plurk-adapter.js"), "utf8"), context);
  context.PlurkBatchAdapter.restoreGroup(doc);
  return {
    get clicks() { return clicks; }, get removed() { return removed; },
    get disconnected() { return disconnected; },
    ready() { ready = true; callback?.(); }, notify() { callback?.(); }
  };
}

test("restore prior group once, after native default selection is initialized", () => {
  const f = fixture({ id: "50", at: Date.now() });
  assert.equal(f.removed, 1, "consume the reload marker immediately");
  assert.equal(f.clicks, 0);
  f.ready();
  assert.equal(f.clicks, 1);
  assert.equal(f.disconnected, 1);
  f.notify();
  assert.equal(f.clicks, 1);
});

test("expired or invalid selection never overrides native selection", () => {
  for (const saved of [null, { id: "50", at: 0 }, { id: '50"]', at: Date.now() }]) {
    const f = fixture(saved);
    f.ready();
    assert.equal(f.clicks, 0);
  }
});
