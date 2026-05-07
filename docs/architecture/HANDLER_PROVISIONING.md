# Handler Provisioning Runbook

**Phase:** 3 + 8 (transport revised to QR-in-person)
**Status:** LOCKED — 7 May 2026
**Audience:** Rishabh (admin) + Claude Code (implementation reference)
**Purpose:** Runbook-grade end-to-end flow for provisioning a new handler. This is the operational manual, not the architectural rationale (see [AUTH_MODEL.md](AUTH_MODEL.md)).

---

## Pre-Requisites

Before provisioning a worker:

1. **Firebase project healthy:** dashboard auth working; provisioning Cloud Function deployed; `provisionWorker` callable from dashboard admin UI
2. **Worker has Android phone:** Per Phase 7 ratification (Android-only handler PWA), iOS phones are unsupported. Owner can procure cheap Android (~Rs 5000) if needed
3. **Worker phone has camera + active data signal:** required for QR scan + first-time auth exchange
4. **Worker is physically present:** the entire flow is in-person (per Phase 8 BLOCKER fix). No remote provisioning in alpha
5. **Admin (Rishabh) has dashboard open:** logged in with `is_admin: true` claim

---

## Step-by-Step Flow

### Step 1 — Add Worker record (dashboard)

1. Open dashboard → **Workers** → **Add new worker**
2. Fill the form:
   - **Name:** worker's full name
   - **Monogram:** 1-2 letters for badge dot (e.g., "RS" for Ramesh Singh)
   - **Role(s):** multi-select. For notebook handler in alpha, select `handler`. Future role-apps add `pickler`, `inspector`, etc.
   - **Home room:** dropdown (vat-room-1, vat-room-2, barrel-room, pickling-area-4, office)
   - **Floatable:** boolean (mostly contractors = floatable)
3. Submit. Behind the scenes, dashboard creates a Worker record in Firestore.

**Audit:** `audit_event` generated with action `'create'`, entity_type `'worker'`, recorded_by `request.auth.uid`.

### Step 2 — Trigger provisioning (dashboard)

1. From the Worker detail page, click **Provision phone**
2. Confirmation dialog: "Provision new handler phone for {worker name}? Token will expire in 5 minutes."
3. Confirm. Dashboard calls `provisionWorker` Cloud Function

**Behind the scenes (CF logic):**
- Verify `worker_id` exists and is not already provisioned
- Generate custom Firebase Auth token with claims `{ worker_id, roles, is_steward, is_admin, active_token_id: <new nanoid> }`
- Update Worker doc: set `active_token_id` field, `provisioned_at: serverTimestamp()`
- Generate QR code data URL encoding the token-bearing URL: `https://rishabh1804.github.io/sep-dashboard/entry/handler/?bootstrap_token={base64-token}` (URL is shown in QR; never sent over transport)
- Return `{qr_code_data_url, expires_at, token_id}` to dashboard

**Audit:** `audit_event` generated with action `'provision'`, entity_type `'worker'`, includes `token_id` reference.

### Step 3 — Display QR code (dashboard)

1. Dashboard renders QR code on screen, large enough to scan from ~30cm
2. Dashboard shows countdown: "Token expires in 4:53"
3. If countdown reaches 0 without scan, dashboard auto-revokes (CF call) and prompts re-provision

### Step 4 — Worker scans QR (worker phone)

1. Worker opens phone camera (Android default camera supports QR)
2. Worker points camera at dashboard screen, taps the URL preview
3. URL opens in Chrome/Firefox

### Step 5 — Token exchange (handler PWA)

Browser-side JS reads `bootstrap_token` query param:

1. Strip `bootstrap_token` from URL immediately via `history.replaceState({}, '', '/entry/handler/')` (per Phase 4 lock — leaves no trace in history)
2. Call `signInWithCustomToken(token)` on Firebase Auth client
3. Firebase exchanges custom token for ID token + refresh token; stores in IndexedDB
4. App enters authenticated state; renders home screen with form tile grid

**Audit:** `audit_event` generated with action `'auth_exchange'`, entity_type `'worker'`, recorded_by `request.auth.uid`.

### Step 6 — Install PWA (worker phone)

1. After authenticated load, browser shows "Install app" prompt (or worker uses Chrome menu → Install)
2. Worker accepts; PWA installed with handler manifest
3. PWA icon appears on home screen
4. `start_url: '/entry/handler/'` (no auth params; already authenticated via persistent IndexedDB session)

### Step 7 — Verify (dashboard)

1. Dashboard automatically detects: Worker doc updated with `provisioned_at` + `active_token_id` + first ID-token-fetch event
2. Dashboard displays "✓ {worker name} provisioned successfully — first auth at {timestamp}"
3. Worker doc shows status: `active`, `provisioned_at`, `last_seen_at` (updated on each app open)

### Step 8 — Onboarding (in-person)

Owner walks worker through:

1. Show home screen — explain the form tiles
2. Have worker submit one **test Production Entry** (synthetic data)
3. Verify entry appears in dashboard activity stream within 5 seconds
4. Show worker the **sync chip** (top right) and what colors mean (green = synced, orange = offline-queued, blue = syncing)
5. Show **Recent Entries log** on home — visual confirmation that data is landing
6. Optional: walk through one entry of every form they'll use day-1

Total time: ~10-15 minutes per worker.

---

## Common Failures + Recovery

### Token expired (5 min reached)

**Symptom:** Worker scans QR after 5 minutes; PWA shows "Token expired" error.
**Recovery:** Owner clicks **Re-provision** in dashboard (auto-revokes old, mints new). Worker re-scans new QR. Audit shows both attempts.

### QR scan opens wrong URL

**Symptom:** Worker's camera/scanner opens URL in different app or browser.
**Recovery:** Use Chrome explicitly. Owner can copy URL from dashboard ("Reveal URL" button) and worker pastes manually if needed (URL has 5min validity).

### `signInWithCustomToken` fails (network error)

**Symptom:** PWA shows "Auth failed — check connection" after URL opens.
**Recovery:**
1. Verify worker phone has data signal
2. Refresh page (token still valid for remaining time)
3. If still failing, owner re-provisions

### Token already exchanged (replay attempt)

**Symptom:** Custom token marked as used; second exchange returns error.
**Recovery:** This is expected on legitimate one-shot use. If worker accidentally closes browser before PWA installs, owner re-provisions.

### Worker phone storage full

**Symptom:** PWA install fails or IndexedDB write fails.
**Recovery:** Worker frees up space (delete photos, etc.). Re-attempt.

### Worker has iOS phone (unsupported)

**Symptom:** Phase 7 ratification: handler PWA Android-only.
**Recovery:** Owner provides Android phone (~Rs 5000 procurement) OR worker delays joining until Android phone available. Document in [DEPLOY_TOPOLOGY.md](DEPLOY_TOPOLOGY.md) for Phase 2.1 iOS-support discussion.

### Custom claims size limit hit (1KB)

**Symptom:** Provisioning CF logs warning: "Custom claims approaching 1KB cap." Eventually fails when cap reached.
**Recovery:** Reduce claim verbosity (shorten role names, consolidate booleans). Document in [SCHEMA_CHANGELOG.md](SCHEMA_CHANGELOG.md) when claim shape changes.

---

## Re-Issue Token Flow (Lost Phone, Returning Worker, etc.)

When a worker loses their phone, returns from extended absence, or otherwise needs a fresh token:

1. Open dashboard → **Workers** → select worker → **Re-issue token**
2. Confirmation dialog explains: "Old token will be invalidated. Any unsynced writes from old phone will be REJECTED on reconnect (visible in Steward inbox)."
3. Confirm. CF rotates `active_token_id` field; mints new custom token; generates new QR
4. Old phone's queued writes (when it eventually reconnects) hit security rule check `request.auth.token.token_id == worker.active_token_id` → fail with `PERMISSION_DENIED`
5. Steward inbox shows "Rejected writes from rotated token" with detail; steward decides whether to retry-via-handler-app or discard
6. New phone scans new QR; standard provisioning Steps 4-8 apply

**Audit:** `audit_event` with action `'token_reissue'`, includes both `old_token_id` and `new_token_id`.

---

## Revocation Flow (Fired Worker, Suspected Misuse)

### Soft revocation (planned firing, lost-phone-found-later)

1. Open dashboard → **Workers** → select worker → **Revoke (soft)**
2. Confirmation: "Worker auth will be revoked. ID tokens already issued remain valid up to 1 hour. Reads cut off within 15min via forced token refresh."
3. Confirm. CF calls `auth.revokeRefreshTokens(uid)`. Existing refresh tokens invalidated; existing ID tokens valid until expiry.
4. After ~1h, all sessions are dead.

### Immediate revocation (stolen phone, security incident)

1. Open dashboard → **Workers** → select worker → **Revoke (immediate)**
2. Confirmation explicitly warns: "All writes blocked instantly. Reads cut off within 15min. ESCALATION USE ONLY."
3. Confirm. Worker doc: set `revoked_at: serverTimestamp()`. Refresh tokens revoked.
4. Every subsequent write hits security rule `notRevoked()` → fails immediately.
5. Audit log gets a flood of failed-write events; steward inbox surfaces them with red severity.

**Audit:** `audit_event` with action `'revoke_soft'` or `'revoke_immediate'`; includes reason (free text or enum).

---

## Audit Trail Expectations

Every step in the provisioning flow generates an audit event:

| Step | Action | Entity |
|---|---|---|
| 1 | `worker.create` | Worker |
| 2 | `worker.provision` | Worker |
| 5 | `worker.auth_exchange` | Worker (first auth) |
| 5+ | `worker.id_token_refresh` | Worker (every 15min thereafter) |
| 8 (test entry) | `production_entry.create` | ProductionEntry (with `app_version` claim) |
| Re-issue | `worker.token_reissue` | Worker |
| Revoke | `worker.revoke_soft` or `worker.revoke_immediate` | Worker |

These let the steward and admin reconstruct exactly what happened during provisioning when investigating issues.

---

## FAQ

**Q: Can I provision a worker remotely (no in-person)?**
A: Not in alpha. Phase 8 ratified QR-in-person to defeat URL-transport leaks. If remote provisioning becomes necessary later, two-factor (URL + separately-channeled PIN) is the next-best option; design pass needed.

**Q: What if a worker has multiple roles (e.g., Pickler + Inspector)?**
A: One Worker record + one Firebase Auth user + multi-role custom claims `roles: ['pickler', 'inspector']`. They install one PWA per role they actively use (provisioning generates separate QR codes pointing to different role-app subpaths). PWA installs are per-URL, so worker has multiple icons on their home screen.

**Q: Can I reset a worker's PWA without re-provisioning?**
A: Yes. Worker uninstalls PWA → reinstalls from same URL. Their refresh token persists in IndexedDB across PWA reinstalls (same origin). Only re-issue token if you suspect compromise.

**Q: How do I rotate the dashboard PAT (used for topic digest commits)?**
A: Different concern from worker provisioning. PAT rotation: update Firebase Functions secret via `firebase functions:secrets:set GITHUB_PAT`. Out of scope for this runbook.

**Q: What happens to topic digests when a worker is revoked?**
A: Their `worker_id` continues appearing in historical topic content (preserves forensic record). Hourly cron continues to run; revoked worker's `topics/workers/{id}.md` shows `status: revoked` in frontmatter. Aurelius / Claude Code reading that topic see the revocation as part of the operational record.

---

## Related

- [AUTH_MODEL.md](AUTH_MODEL.md) — architectural rationale + custom claims structure
- [FIRESTORE_RULES.md](FIRESTORE_RULES.md) — how `active_token_id` and `notRevoked()` are enforced
- [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md) — rejected-write inbox; worker provisioning admin UI
- [CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md) — `provisionWorker` CF detail
- [HANDLER_UI_SHELL.md](HANDLER_UI_SHELL.md) — what the worker sees post-provisioning

---

*Runbook authored 7 May 2026 by Aurelius. Treat as live document — update on every provisioning workflow change.*
