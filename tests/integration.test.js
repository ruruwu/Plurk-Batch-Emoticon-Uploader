"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

test("first custom-tab click waits for queue completion and refreshes once", async () => {
  const listeners = new Map();
  let finish;
  let reloads = 0;
  const completion = new Promise(resolve => { finish = resolve; });
  const element = () => ({
    dataset: {}, style: {}, addEventListener() {}, remove() {},
    contains: () => true, append() {}
  });
  const root = { ...element(), isConnected: true };
  const view = {
    host: element(), nativeRefreshPending: true,
    waitForNativeRefresh: () => completion,
    clear() {}, destroy() {}
  };
  const doc = {
    createElement: element, documentElement: element(),
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name)
  };
  const context = vm.createContext({
    PlurkBatchView: { create: () => view },
    MutationObserver: class { observe() {} disconnect() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/integration.js"), "utf8"), context);
  const integration = context.PlurkBatchIntegration.start(doc, {
    findRoots: () => [root],
    resolve: () => ({ entryHost: element(), panelHost: element(),
      nativeRegions: [{ ...element(), contains: () => false }],
      refreshNative: () => { reloads++; return true; } })
  });
  let prevented = 0;
  const event = {
    target: { closest: () => ({ classList: { contains: () => false } }) },
    preventDefault: () => prevented++, stopImmediatePropagation() {}
  };
  listeners.get("click")(event);
  listeners.get("click")(event);
  assert.equal(prevented, 2);
  assert.equal(reloads, 0, "never reload while the queue is finishing");
  finish(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reloads, 1, "the first click is retained; repeated clicks are coalesced");
  integration.stop();
  assert.equal(listeners.has("click"), false);
});
