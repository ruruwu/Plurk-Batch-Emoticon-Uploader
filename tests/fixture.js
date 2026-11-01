"use strict";
const mount = document.querySelector("#mount");
const results = document.querySelector("#results");
let nativeClicks = 0;
function render() {
  const root = document.querySelector("#manager");
  if (!root) return;
  root.replaceChildren();
  for (const name of ["entry", "native", "panel"]) {
    const el = document.createElement("div");
    el.dataset.fixture = name;
    root.append(el);
  }
  const native = root.querySelector('[data-fixture="native"]');
  const button = document.createElement("button");
  button.textContent = "原生功能替身（計數）";
  button.addEventListener("click", () => { nativeClicks++; results.textContent = `原生按鈕點擊：${nativeClicks}`; });
  native.append(button);
}
function open() {
  if (document.querySelector("#manager")) return;
  const root = document.createElement("section");
  root.id = "manager";
  mount.append(root);
  render();
}
function close() { mount.replaceChildren(); }
const integration = PlurkBatchIntegration.start(document, {
  findRoots(scope) {
    return [...(scope.matches?.("#manager") ? [scope] : []), ...scope.querySelectorAll("#manager")];
  },
  resolve(root) {
    const entryHost = root.querySelector('[data-fixture="entry"]');
    const panelHost = root.querySelector('[data-fixture="panel"]');
    const native = root.querySelector('[data-fixture="native"]');
    return entryHost && panelHost && native ? { entryHost, panelHost, nativeRegions: [native] } : null;
  }
});
document.querySelector("#open").onclick = open;
document.querySelector("#close").onclick = close;
document.querySelector("#render").onclick = render;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
document.querySelector("#checks").onclick = async () => {
  const lines = [];
  const check = (condition, label) => { lines.push(`${condition ? "PASS" : "FAIL"} ${label}`); };
  const count = () => document.querySelectorAll('[data-plurk-batch-owned="entry"]').length;
  close(); await tick(); check(count() === 0, "一般頁面無入口");
  open(); await tick(); check(count() === 1, "首次開啟只有一個入口");
  document.querySelector('[data-plurk-batch-owned="entry"]').click();
  check(document.querySelector('[data-fixture="native"]').hidden, "批次介面隱藏原生區域");
  const host = document.querySelector('[data-plurk-batch-owned="panel"]');
  check(!host.hidden && host.shadowRoot.querySelector('input[type="file"]').multiple, "顯示多選介面");
  check(host.shadowRoot.querySelector("footer button:disabled") !== null, "開始上傳停用");
  host.shadowRoot.querySelector("footer button").click();
  check(!document.querySelector('[data-fixture="native"]').hidden, "返回後還原原生區域");
  document.querySelector('[data-fixture="native"] button').click();
  check(nativeClicks > 0, "原生事件仍可執行");
  render(); await tick(); check(count() === 1, "重繪後只有一個入口");
  close(); await tick(); open(); await tick(); check(count() === 1, "關閉重開只有一個入口");
  const root = document.querySelector("#manager");
  root.hidden = true; root.hidden = false; await tick(); check(count() === 1, "隱藏後重開不重複");
  integration.stop(); check(count() === 0, "停止整合會移除元件");
  results.textContent = lines.join("\n") + "\n停止整合後請重新載入測試頁。多圖預覽需另行手動選檔驗證。";
};
