import {
  APP_VERSION,
  localDateStr
} from "./chunks/chunk-D5KUF7LV.js";

// src/handler/main.js
function boot() {
  const root = document.getElementById("handler-root");
  if (!root) return;
  root.innerHTML = `<div class="card-hero">
    <div class="card-label">SEP Handler</div>
    <div class="card-value-xl">Phase 2.0 stub</div>
    <div class="card-meta mt-8">v${APP_VERSION} \xB7 ${localDateStr()}</div>
    <p class="card-meta mt-12">
      The notebook handler app ships in Stage C\u2013D of Session 13.
      This bundle proves the multi-entry build is wired correctly.
      See <code>docs/architecture/HANDLER_UI_SHELL.md</code> for the spec.
    </p>
    <a class="btn btn-secondary mt-12" href="../../">\u2190 Dashboard</a>
  </div>`;
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
//# sourceMappingURL=handler.js.map
