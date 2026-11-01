/* 依使用者提供的 DOM 快照建立，尚未實機驗證。
 * adapter 提供 findRoots(scope)、resolve(root)。
 * resolve 回傳 { entryHost, panelHost, nativeRegions, styleEntry? }。
 * panelHost 不可位於會被隱藏的 nativeRegions 中；入口可放在原生選檔區。
 */
// Selectors below come from user-provided DOM, not a live browser inspection.
globalThis.PlurkBatchAdapter = {
  restoreGroup(doc) {
    const win = doc.defaultView;
    const key = "plurk-batch-restore-group-v1";
    let saved;
    try {
      saved = JSON.parse(win.sessionStorage.getItem(key));
      win.sessionStorage.removeItem(key);
    } catch { return; }
    if (!saved || !/^\d+$/.test(saved.id) ||
        !Number.isFinite(saved.at) || Math.abs(Date.now() - saved.at) > 30000) return;
    let timer;
    let done = false;
    const observer = new MutationObserver(restore);
    function restore() {
      if (done) return;
      const host = doc.querySelector("#em-groups-bar-fragment-host");
      // Wait for native initialization to select its default group before
      // restoring the previous selection through the native click handler.
      if (!host?.querySelector("li.current[data-g]")) return;
      const group = host.querySelector(`li[data-g="${saved.id}"]`);
      if (!group) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      group.click();
    }
    observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    timer = setTimeout(() => { done = true; observer.disconnect(); }, 10000);
    restore();
  },
  findRoots(scope) {
    const roots = new Set(scope.querySelectorAll("#uploader-fragment"));
    const enclosing = scope.closest?.("#uploader-fragment");
    if (enclosing) roots.add(enclosing);
    return [...roots];
  },
  resolve(root) {
    if (root.parentElement?.id !== "fragment-container") return null;
    const panel = root.querySelector(":scope > #uploader-panel");
    if (!panel?.querySelector("#file-uploader-selecter-btn") ||
        !panel.querySelector('input#file-uploader-selecter[type="file"]')) return null;
    return {
      entryHost: panel.querySelector("#file-uploader"), panelHost: root, nativeRegions: [panel],
      refreshNative() {
        const win = root.ownerDocument.defaultView;
        const checks = {
          connected: root.isConnected,
          hasWindow: !!win,
          framed: !!win && win !== win.top,
          originMatches: win?.location.origin === "https://www.plurk.com",
          pathMatches: /^\/EmoticonManager2\/?$/.test(win?.location.pathname || "")
        };
        if (!Object.values(checks).every(Boolean)) {
          return false;
        }
        try {
          // Keep only the native selection, not the batch upload target.
          // sessionStorage survives this iframe reload and is consumed once.
          try {
            const id = root.ownerDocument.querySelector(
              '#em-groups-bar-fragment-host li.current[data-g]'
            )?.getAttribute("data-g");
            if (/^\d+$/.test(id || "")) win.sessionStorage.setItem(
              "plurk-batch-restore-group-v1", JSON.stringify({ id, at: Date.now() })
            );
          } catch { /* Storage restrictions must not prevent refreshing. */ }
          win.location.reload();
          return true;
        } catch {
          return false;
        }
      },
      prepareView(host) {
        // Measure the visible native panel before hiding it. Fixed positioning
        // avoids relying on the site's unknown absolute-positioned fragment CSS.
        const rect = panel.getBoundingClientRect();
        const top = Math.max(8, rect.top);
        const left = Math.max(8, rect.left);
        Object.assign(host.style, {
          position: "fixed", top: `${top}px`, left: `${left}px`,
          right: "8px", width: "auto",
          height: `calc(100vh - ${top + 8}px)`,
          maxHeight: `calc(100vh - ${top + 8}px)`,
          overflow: "hidden", zIndex: "10", boxSizing: "border-box"
        });
      },
      styleEntry(button) {
        button.classList.add("button");
        const native = panel.querySelector("#file-uploader-selecter-btn");
        const computed = root.ownerDocument.defaultView.getComputedStyle(native);
        // A native div and an HTML button have different browser defaults.
        // Match the native box and font so their inline baselines align.
        for (const property of ["font", "line-height", "padding", "border", "box-sizing", "vertical-align", "height"]) {
          button.style.setProperty(property, computed.getPropertyValue(property));
        }
        button.style.margin = computed.margin;
        button.style.marginLeft = "12px";
        button.style.position = "relative";
        button.style.display = "inline-block";
      }
    };
  }
};
