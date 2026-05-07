// Handler PWA — Phase 2.0 entry point stub.
//
// Per docs/architecture/DEPLOY_TOPOLOGY.md, this is the second
// role-app in the N-PWA monorepo. The full handler shell + 9 forms
// (HANDLER_UI_SHELL.md / HANDLER_FORMS.md) ship in Stage C-D of the
// data-capture-first reframe. For now, this is a navigable
// placeholder that confirms the multi-entry build pipeline works.

import { APP_VERSION } from '../shared/config/app.js';
import { localDateStr } from '../shared/utils/date.js';

function boot() {
  const root = document.getElementById('handler-root');
  if (!root) return;
  root.innerHTML = `<div class="card-hero">
    <div class="card-label">SEP Handler</div>
    <div class="card-value-xl">Phase 2.0 stub</div>
    <div class="card-meta mt-8">v${APP_VERSION} · ${localDateStr()}</div>
    <p class="card-meta mt-12">
      The notebook handler app ships in Stage C–D of Session 13.
      This bundle proves the multi-entry build is wired correctly.
      See <code>docs/architecture/HANDLER_UI_SHELL.md</code> for the spec.
    </p>
    <a class="btn btn-secondary mt-12" href="../../">← Dashboard</a>
  </div>`;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
