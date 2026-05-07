# Auth Model

**Phase:** 3 (with Phase 4 + 8 refinements folded in)
**Status:** LOCKED — 7 May 2026
**Companion:** [HANDLER_PROVISIONING.md](HANDLER_PROVISIONING.md) — runbook-grade flow

---

## Problem

Auth has to deliver six things:

1. **Identity attribution on every write** — `author_user_id` populated automatically from Firebase Auth, never spoofable
2. **Role-app enforcement** — handler app installation only writes handler-scoped data; Inspector app only writes DFT measurements; etc.
3. **Provisioning flow that scales** — Rishabh adds a worker → that worker's phone gets authenticated → starts entering data. No password typing, no email round-trips
4. **Revocation** — fired worker, lost phone, suspected misuse: cut off cleanly
5. **Multi-role support** — one worker can fulfill multiple roles
6. **Persistent auth** — handler opens PWA every shift; should not have to re-authenticate

## Options Considered

| Provider | Verdict |
|---|---|
| Email/password | Handlers don't have email setup hygiene; password reset friction kills onboarding |
| Phone OTP | SMS dependency, OTP friction every device change, $0.01/SMS adds up |
| Google Sign-In | Assumes every handler has a Google account; same hygiene problem |
| Custom tokens | **Selected** — server-controlled, zero-typing UX, no third-party IdP |
| Anonymous | Kills audit attribution; never acceptable |

## Adversarial Findings

Phase 4 surfaced **BLOCKER 1** — token in URL leaks via Referer headers, browser history, WhatsApp forwarding. Phase 4 ratified strip-on-load + service-worker handoff as partial fix.

Phase 8 re-confirmed Phase 4 BLOCKER 1 wasn't fully solved: WhatsApp's link-preview crawler can exchange the token before the worker opens. Resolved by **switching transport entirely to QR-in-person** (see HANDLER_PROVISIONING.md). Service-worker handoff still applies if URL transport is ever used (e.g., for steward provisioning where in-person is impractical), but is no longer the primary mechanism.

Phase 8 also surfaced **HIGH** — re-issue token doesn't kill old phone's offline queue (rules check `Worker.id`, unchanged). Resolved by `active_token_id` rotation with rejected-write inbox.

## Locked Decision

**Firebase Auth with custom tokens issued by Cloud Function on worker provisioning.**

### Custom claims structure

```typescript
{
  worker_id: 'w-001',                   // = Firebase Auth UID for handler-role workers
  roles: ['handler', 'inspector'],      // array (multi-role support)
  is_steward: true,                     // separate flag for data steward role
  is_admin: false,                      // dashboard-admin powers (Rishabh-only initially)
  active_token_id: 'tok_abc123',        // rotated on re-issue (Phase 8 lock)
}
```

Security rules read `request.auth.token.roles`, `request.auth.token.is_steward`, `request.auth.token.is_admin`, `request.auth.token.active_token_id` to enforce per-app + per-action authorization.

**Custom claims size limit (G4 from Phase 4 adversary):** 1KB total payload. Provisioning CF checks size before issuance; alerts admin if approaching cap. Documented in HANDLER_PROVISIONING.md.

### Provisioning flow (high-level)

1. Rishabh adds worker in dashboard (name, monogram, role(s), home_room)
2. Backend Cloud Function creates Firebase Auth user with `uid = Worker.id`, sets custom claims, mints custom token, generates QR code embedding the token
3. Dashboard displays QR code; Rishabh scans worker's phone in person
4. Worker phone opens URL via QR scan → JS exchanges custom token via `signInWithCustomToken`
5. Firebase issues persistent ID token + refresh token, stored in IndexedDB
6. Worker installs PWA from URL → `start_url` carries no auth params (already authenticated)
7. Worker uses PWA across shifts; Firebase refresh token machinery keeps session valid indefinitely

**Detailed runbook:** [HANDLER_PROVISIONING.md](HANDLER_PROVISIONING.md).

### Two-tier revocation (Phase 4 hybrid)

| Tier | Mechanism | Tail |
|---|---|---|
| **Soft** (default for fired workers) | Admin SDK `auth.revokeRefreshTokens(uid)` | Up to 1h until existing ID token expires |
| **Immediate** (for stolen phone, suspected misuse) | Set `Worker.revoked_at` field; rules check on every write via `notRevoked()` helper | Instant for writes; reads cut off within 15min via forced token refresh on client |

Soft is the common case (planned firings, lost phones found later). Immediate is escalation (genuine security incidents).

### `active_token_id` rotation (Phase 8)

- Worker doc carries `active_token_id` field
- Provisioning CF mints token with `token_id` custom claim equal to `active_token_id`
- Rules check `request.auth.token.token_id == get(/workers/{auth.uid}).data.active_token_id`
- Re-issue (lost phone, returning worker, etc.) rotates `active_token_id` to a new value
- Old token's writes (even from offline queue replay) get `PERMISSION_DENIED`
- Dashboard shows steward-visible "rejected writes from rotated token" inbox so legitimate work isn't silently lost

### Dashboard admin auth (Rishabh)

Different flow because Rishabh logs in from desktop, not provisioned phone PWA:

- **Provider:** Email/password (Firebase Auth standard) OR Google Sign-In (Rishabh's preference)
- **Custom claim:** `is_admin: true`
- **Persistent session:** Browser-cached, refreshable indefinitely until manual logout

Adding additional dashboard-side admins later = creating users with `is_admin: true`. No architectural change.

## Rationale

- **Custom tokens** give zero-typing UX (handler scans QR, immediately authenticated) without third-party IdP dependency
- **Custom claims** centralize authorization data; security rules check claims efficiently (no extra Firestore reads for role checks; only `notRevoked()` does an extra read)
- **Two-tier revocation** balances cost (claims-cached cheap; per-write `notRevoked()` read costs ~0.6% of free tier at our scale) against urgency (immediate revocation for genuine incidents)
- **`active_token_id` rotation** closes the offline-queue exploit that the simpler revocation models miss
- **QR-in-person provisioning** eliminates the URL-transport class of leaks at our scale (<12 handlers; in-person is operationally trivial)

## Acceptance Criteria (the bar)

- [ ] Provisioning Cloud Function deployed; tested end-to-end via emulator suite
- [ ] QR code generation library (recommended: `qrcode` npm) integrated in dashboard
- [ ] Custom claims set correctly on user creation; verified via `auth.getUser(uid)` inspection
- [ ] Security rules check `roles[]`, `is_steward`, `is_admin`, `token_id` correctly per [FIRESTORE_RULES.md](FIRESTORE_RULES.md)
- [ ] `notRevoked()` rule helper correctly reads `revoked_at` field; soft + immediate revocation tested
- [ ] `active_token_id` rotation tested: re-issue invalidates old token even from offline queue replay
- [ ] Rejected-write inbox surfaces in dashboard for steward review (per [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md))
- [ ] Dashboard admin auth (Rishabh) functional via email/password OR Google Sign-In; persistent session works across browser refreshes
- [ ] Audit event generated on every: provisioning, custom-claim change, soft-revocation, immediate-revocation, token re-issue

## Implementation Notes

- Provisioning CF: `functions/src/auth/provisionWorker.ts`. Input: `{worker_id, name, roles, home_room}`. Output: `{custom_token, qr_code_data_url, expires_at}`. Token TTL: 5 minutes (forces in-person workflow; if scan doesn't happen quickly, owner re-mints)
- Use Firebase Admin SDK `auth.createCustomToken(uid, additionalClaims)`
- For multi-role workers: `roles` is an array; client app on boot checks `'handler' in claims.roles` to decide which app shell to render (defensive — server-side rules are the truth)
- `active_token_id` value: short random string (e.g., `nanoid(12)`); stored on Worker doc; updated atomically with token issuance via Firestore transaction
- `notRevoked()` security rule helper: `get(/databases/$(database)/documents/workers/$(request.auth.uid)).data.revoked_at == null`
- Forced token refresh on client every 15min: `auth.currentUser.getIdToken(true)` — reads fresh custom claims from server; closes the immediate-revocation read tail

## Future Considerations

- **PIN gating per role** (Phase 2.1+) — Steward role might warrant PIN before opening dashboard (admin auth fallback)
- **Biometric auth on handler PWA** (Phase 2.2+) — fingerprint or face unlock before opening; native Web Authentication API
- **Custom claims migration** — when claim shape changes (new role enum value, new flag), provisioning CF needs migration logic; document in [SCHEMA_CHANGELOG.md](SCHEMA_CHANGELOG.md)
- **Multi-tenant** — if SEP grows to multi-org, add `org_id` custom claim and tenant-scope rules

## Related

- [HANDLER_PROVISIONING.md](HANDLER_PROVISIONING.md) — runbook-grade provisioning flow
- [FIRESTORE_RULES.md](FIRESTORE_RULES.md) — how claims are checked in rules
- [DEPLOY_TOPOLOGY.md](DEPLOY_TOPOLOGY.md) — N-PWA pattern that custom claims enforce
- [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md) — rejected-write inbox + worker provisioning UI
- [CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md) — provisioning CF implementation

---

*Authored 7 May 2026 by Aurelius.*
