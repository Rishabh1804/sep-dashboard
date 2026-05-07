# Deploy Topology

**Phase:** 1
**Status:** LOCKED — 7 May 2026
**Supersedes:** Session 12 §2 "Two-PWA monorepo" lock (generalized here to N-PWA)

---

## Problem

Where do the dashboard and handler PWAs physically live? How do they share schema and utilities while having distinct UI shells? How do future role-apps (Inspector, Dispatch, etc.) slot into the architecture without forcing repository fragmentation or breaking the data layer?

## Options Considered

**Option A — Subpath dual-PWA, same monorepo, same Pages site.**
- Two HTML entries (`index.html`, `entry/handler/index.html`)
- Two manifests with explicit `scope` and `start_url`
- Same origin → can share IndexedDB / localStorage / BroadcastChannel for offline coordination
- Two esbuild bundles, Konva/p5 excluded from handler

**Option B — Separate repo per PWA.**
- `sep-handler` repo at `rishabh1804.github.io/sep-handler/`
- Different origin → no shared client storage; Firebase becomes the only sync path
- Independent deploys; doubled GitHub maintenance overhead
- Shared schema/utils require npm package or git submodule

**Option C — Single PWA, dual-mode shell.**
- One manifest, mode toggle inside app
- Forces phone users to download dashboard code (Konva/p5)
- Incompatible with handler bundle budget (<200KB)
- Rejected outright

## Adversarial Findings

Not probed in Phase 1 (foundational decision; chosen before MCQ + adversary pattern). Subsequent phases stress-tested implications:
- **Phase 4 BLOCKER 1** — Token in URL leakage (transport via WhatsApp burns the token via crawler exchange). Resolved in Phase 8 by QR-in-person provisioning, not by changing topology.
- **Phase 7 BLOCKER** — iOS Safari PWA storage eviction. Resolved by Android-only handler PWA + procurement policy (does not change topology).

## Locked Decision

**Subpath dual-PWA monorepo, generalizing to N-PWA as role-apps emerge.**

Repo structure:

```
sep-dashboard/                       (single Git repo)
├── src/
│   ├── shared/                      Layers 1–3 — used by every app
│   │   ├── utils/
│   │   ├── storage/                 Layer 2 with getState/setState accessors
│   │   ├── config/
│   │   └── types/                   Zod schemas (Phase 6)
│   ├── components/                  Layer 4 — shared component library
│   ├── dashboard/main.js            → bundles to /sep-dashboard/
│   ├── handler/main.js              → bundles to /sep-dashboard/entry/handler/
│   ├── inspector/main.js            → /sep-dashboard/entry/inspector/   (Phase 2.1)
│   ├── dispatch/main.js             → /sep-dashboard/entry/dispatch/    (Phase 2.1+)
│   └── ... one folder per role-app as added
├── public/
│   ├── manifest-dashboard.json
│   ├── manifest-handler.json
│   ├── manifest-inspector.json      (Phase 2.1)
│   └── ... one per app
├── functions/                       Firebase Cloud Functions
└── esbuild.config.js                multi-entry config
```

**Middle path for Layer 4** (ratified in Phase 1.5): shared Layer-4 component library consumed by every role-app; each role-app owns its Layer 5+ screens. Reuses common UI primitives (form fields, picker grids, sync chips) without coupling apps' release cycles.

**Service worker model**: one root-scoped SW at `/sep-dashboard/sw.js` controlling all paths, with internal path-aware caching strategies. Phase 2.1+ may split if cache strategies diverge.

**Manifest details per PWA**: distinct `name`, `short_name`, `theme_color`, `scope`, `start_url`. Each phone-installable independently with own icon.

## Rationale

| Concern | Result |
|---|---|
| Shared schema, utils, storage layer | Direct import within repo (Layer 1-3) |
| Offline coordination if Firebase down | Same-origin storage primitives available |
| Deploy independence | Coupled (acceptable; tag-based atomic releases) |
| Rollback granularity | Coupled (revert specific role-app folder) |
| GitHub Pages constraint | One repo, one Pages site, multiple paths — works |
| PWA install on phone | Per-manifest scope = per-PWA install with own icon |
| Future role-app addition | One-line esbuild config change + new folder |

Strictly dominates Option B for our scale (single org, <50 handlers anticipated). Mid-phase reframe (Phase 1.5) generalized "two-PWA" to "N-PWA" once role-app pattern was identified — same architecture, more entries.

## Acceptance Criteria (the bar)

- [ ] esbuild config accepts N entry points; adding a new role-app is a one-line config change
- [ ] Each PWA installable on Android with distinct icon, name, theme color
- [ ] Layer 1-3 imports work transparently across all role-app entry points
- [ ] Layer 4 component library consumed by both dashboard and handler PWAs without modification
- [ ] Bundle size budget: dashboard <800KB, handler <200KB (per Session 12 lock)
- [ ] Service worker scope verified: `/entry/handler/` install does not capture `/` dashboard navigation
- [ ] All apps deploy atomically via single `firebase deploy` or GitHub Pages push

## Implementation Notes

- Use `esbuild.build({ entryPoints: { dashboard: 'src/dashboard/main.js', handler: 'src/handler/main.js' } })` with `splitting: true` for shared chunk extraction
- Manifest `start_url` must include any auth-bootstrap params (e.g., for handler: `start_url: '/sep-dashboard/entry/handler/'` since QR-in-person flow does not embed token in URL — see `HANDLER_PROVISIONING.md`)
- Cache-first SW strategy for shared bundles; network-first for `index.html` to ensure new builds reach users
- Test PWA install on real Android device (Chrome + Firefox); virtual emulators may not surface install banner correctly

## Future Considerations

- **Inspector PWA** (Phase 2.1) — first additional role-app; entry at `/entry/inspector/`
- **Dispatch PWA** (Phase 2.1+) — second
- **Plating Operator / Pickler / Barrel Operator PWAs** — added when role specialization warrants; prior to that, handler app absorbs their data
- **Customer-facing portal** (Phase 2.2+) — would be a third PWA in the monorepo per Session 12 §10 backlog
- **Service worker split** — if cache strategies diverge significantly per role-app, split into per-app SWs with narrower scope

## Related

- [HANDLER_UI_SHELL.md](HANDLER_UI_SHELL.md) — Layer 5+ shell for handler role-app
- [AUTH_MODEL.md](AUTH_MODEL.md) — custom claims `roles[]` enforce per-role-app boundaries server-side
- [HANDLER_PROVISIONING.md](HANDLER_PROVISIONING.md) — QR-in-person flow (no URL token embedding)
- [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) — schema evolution across multiple PWA versions

---

*Authored 7 May 2026 by Aurelius.*
