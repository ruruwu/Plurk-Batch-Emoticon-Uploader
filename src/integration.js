(() => {
  "use strict";
  function start(doc, adapter, api = null) {
    const states = new Map();
    const owned = node => node.nodeType === 1 && node.closest("[data-plurk-batch-owned]");
    function dispose(root) {
      const state = states.get(root);
      if (!state) return;
      state.restore();
      state.observer.disconnect();
      doc.removeEventListener("click", state.onCustomTab, true);
      state.button.remove();
      state.view.destroy();
      states.delete(root);
    }
    function reconcile(root) {
      if (!root.isConnected) return dispose(root);
      const parts = adapter.resolve(root);
      let state = states.get(root);
      if (!parts) return dispose(root);
      const { entryHost, panelHost, nativeRegions } = parts;
      if (![entryHost, panelHost, ...nativeRegions].every(el => el && root.contains(el))) return dispose(root);
      // The entry may live inside native content; the replacement panel may not.
      if (nativeRegions.some(el => el.contains(panelHost))) return dispose(root);
      if (state && (state.entryHost !== entryHost || state.panelHost !== panelHost ||
        state.regions.length !== nativeRegions.length || state.regions.some((el, i) => el !== nativeRegions[i]))) {
        dispose(root);
        state = null;
      }
      if (state) {
        if (!entryHost.contains(state.button)) entryHost.append(state.button);
        if (!panelHost.contains(state.view.host)) panelHost.append(state.view.host);
        return;
      }
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = "批次上傳";
      button.dataset.plurkBatchOwned = "entry";
      if (parts.styleEntry) parts.styleEntry(button);
      let saved = null;
      const restore = () => {
        if (saved) saved.forEach(([el, hidden, display, priority]) => {
          el.hidden = hidden;
          if (display) el.style.setProperty("display", display, priority);
          else el.style.removeProperty("display");
        });
        saved = null;
        view.host.hidden = true;
        button.hidden = false;
        view.clear();
      };
      const view = globalThis.PlurkBatchView.create(doc, refreshNative => {
        restore();
        if (!refreshNative || !parts.refreshNative?.()) button.focus();
      }, api);
      let returningToCustom = false;
      const onCustomTab = event => {
        const tab = event.target.closest?.('#pop-window-tabs a[data-fragment="em"]');
        if (!tab || tab.classList.contains("disabled") || !root.isConnected ||
            !parts.refreshNative || !view.nativeRefreshPending) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (returningToCustom) return;
        returningToCustom = true;
        void (async () => {
          const refresh = await view.waitForNativeRefresh();
          returningToCustom = false;
          if (!root.isConnected || states.get(root)?.view !== view) return;
          if (refresh && parts.refreshNative()) return;
          // On a stopped/failed run, allow native navigation without issuing
          // another API request or replaying this interception.
          doc.removeEventListener("click", onCustomTab, true);
          try { tab.click(); }
          finally { doc.addEventListener("click", onCustomTab, true); }
        })();
      };
      doc.addEventListener("click", onCustomTab, true);
      button.addEventListener("click", () => {
        if (saved) return;
        if (parts.prepareView) parts.prepareView(view.host);
        saved = nativeRegions.map(el => [el, el.hidden, el.style.getPropertyValue("display"), el.style.getPropertyPriority("display")]);
        nativeRegions.forEach(el => {
          el.hidden = true;
          el.style.setProperty("display", "none", "important");
        });
        button.hidden = true;
        view.host.hidden = false;
        view.open();
        view.host.shadowRoot.querySelector("input").focus();
      });
      const observer = new MutationObserver(records => {
        if (!entryHost.contains(button) || !panelHost.contains(view.host) || records.some(record => !owned(record.target) &&
          [...record.addedNodes, ...record.removedNodes].some(node => !owned(node)))) reconcile(root);
      });
      states.set(root, { entryHost, panelHost, regions: nativeRegions, button, view, restore, observer, onCustomTab });
      entryHost.append(button);
      panelHost.append(view.host);
      observer.observe(root, { childList: true, subtree: true });
    }
    // 全頁僅檢查新增的子樹；管理視窗內的重繪由局部 observer 處理。
    const discovery = new MutationObserver(records => {
      for (const root of states.keys()) if (!root.isConnected) dispose(root);
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== 1 || owned(node) || [...states.keys()].some(root => root.contains(node))) continue;
        for (const root of adapter.findRoots(node)) reconcile(root);
      }
    });
    for (const root of adapter.findRoots(doc)) reconcile(root);
    discovery.observe(doc.documentElement, { childList: true, subtree: true });
    return { stop() { discovery.disconnect(); for (const root of states.keys()) dispose(root); } };
  }
  globalThis.PlurkBatchIntegration = { start };
})();
