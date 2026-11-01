(() => {
  "use strict";
  if (!/^\/EmoticonManager2\/?$/.test(location.pathname)) return;
  if (!globalThis.PlurkBatchAdapter || globalThis.__plurkBatchIntegration) return;
  globalThis.PlurkBatchAdapter.restoreGroup(document);
  globalThis.__plurkBatchIntegration = globalThis.PlurkBatchIntegration.start(
    document, globalThis.PlurkBatchAdapter, globalThis.PlurkBatchApi
  );
})();
