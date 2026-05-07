# Firestore Security Rules

**Phase:** 4
**Status:** LOCKED — 7 May 2026 (8 strengthened locks via 2 MCQ rounds + adversary probe)
**Deployable file:** [../reference/FIRESTORE_RULES.ref.txt](../reference/FIRESTORE_RULES.ref.txt)

---

## Problem

Translate Phase 2 compartments + Phase 3 auth model into the actual rules file Firebase enforces server-side. Three goals:

1. **Identity attribution invariant** — every write carries unfakeable `author_user_id`
2. **Role-app enforcement** — handler app can only write handler-scoped data; Inspector only DFT, etc.
3. **Cost-conscious** — every `get()` in a rule costs a Firestore read; budget accordingly

## Adversarial Findings

3 BLOCKER + 7 HIGH + 4 MEDIUM. Most critical:

- **BLOCKER 1 — Token-in-URL leakage** via Referer/history/WhatsApp. Resolved by Phase 8 QR-in-person + Phase 4 service-worker handoff.
- **BLOCKER G1 — `notRevoked()` consumes get() budget**. 10-call limit per rule evaluation; risk grows as more cross-doc checks added.
- **BLOCKER 3 — "Validation deferred to app layer"** = bad data lands first. Resolved by min-bar validation in rules + CF cross-doc invariants.
- **HIGH G3 — Update lets author rewrite `author_user_id` and `created_at`**. Resolved by pinning both on update.
- **HIGH G2 — `request.time vs serverTimestamp` precision quirks**. Document; use `serverTimestamp()` only on create, never on update.
- **HIGH G4 — Custom claims 1KB cap.** Document; provisioning CF monitors size.
- **HIGH structural — App Check missing.** Resolved by Phase 4 Round 2 ratification (App Check day-one).
- **HIGH operational — staging project + emulator CI.** Resolved by Phase 4 Round 2 ratification.

## Locked Decision

### Helper functions

```javascript
function isAuthenticated()  { return request.auth != null; }
function isAdmin()          { return request.auth.token.is_admin == true; }
function isSteward()        { return request.auth.token.is_steward == true; }
function hasRole(r)         { return r in request.auth.token.roles; }
function isSelf(uid)        { return request.auth.uid == uid; }

function notRevoked() {
  return get(/databases/$(database)/documents/workers/$(request.auth.uid))
           .data.revoked_at == null;
}

function withinEditWindow(createdAt) {
  return request.time < createdAt + duration.value(24, 'h');
}

function authoredBySelf() {
  return request.resource.data.author_user_id == request.auth.uid;
}

function timestampIsServerSet() {
  return request.resource.data.created_at == request.time;
}

function activeTokenMatches() {
  return request.auth.token.token_id ==
         get(/databases/$(database)/documents/workers/$(request.auth.uid))
           .data.active_token_id;
}

function authorAndCreatedAtPinned(beforeData) {
  return request.resource.data.author_user_id == beforeData.author_user_id
      && request.resource.data.created_at == beforeData.created_at;
}

function listFilteredToOwnAuthor(query) {
  // Used in list() rules: enforces query has author_user_id == auth.uid filter
  return query.where != null
      && query.where[0].field == 'author_user_id'
      && query.where[0].value == request.auth.uid;
}
```

### Pattern 1 — Append-only events (production_entries, dft_measurements, dispatch_events)

```javascript
match /production_entries/{pid} {
  allow get: if isAuthenticated();
  allow list: if isAdmin() || isSteward() || listFilteredToOwnAuthor(request.query);

  allow create: if isAuthenticated()
               && notRevoked()
               && activeTokenMatches()
               && authoredBySelf()
               && timestampIsServerSet()
               && (hasRole('handler') || hasRole('pickler') || hasRole('barrel-operator')
                   || hasRole('plating-operator') || hasRole('combined-operator'))
               && isValidProductionEntry(request.resource.data);

  allow update: if isAdmin()
               || (request.auth.uid == resource.data.author_user_id
                   && notRevoked()
                   && activeTokenMatches()
                   && authorAndCreatedAtPinned(resource.data)
                   && withinEditWindow(resource.data.created_at)
                   && isValidProductionEntry(request.resource.data));

  allow delete: if isAdmin();    // soft-delete preferred via deleted_at field
}

function isValidProductionEntry(data) {
  return data.qty_pcs is number && data.qty_pcs > 0 && data.qty_pcs < 100000
      && data.machine_id is string
      && data.job_id is string
      && data.station in ['pickling', 'plating', 'inspection', 'dispatch'];
}
```

### Pattern 2 — Mutable state with OCC (jobs, customers, items, etc.)

Online edits go through `runTransaction()` (Phase 5 lock); rules don't need version-field OCC. Just enforce identity + pinning + role:

```javascript
match /jobs/{jid} {
  allow get: if isAuthenticated();
  allow list: if isAuthenticated();    // jobs are queryable by everyone in single-org

  allow create: if isAuthenticated() && notRevoked() && activeTokenMatches()
               && (hasRole('handler') || isAdmin())
               && timestampIsServerSet()
               && isValidJob(request.resource.data);

  allow update: if isAdmin()
               || (hasRole('handler') && notRevoked() && activeTokenMatches()
                   && withinEditWindow(resource.data.created_at)
                   && authorAndCreatedAtPinned(resource.data)
                   && isValidJob(request.resource.data));

  allow delete: if isAdmin();
}
```

### Pattern 3 — Server-only writes (audit_events, topics)

```javascript
match /audit_events/{aid} {
  allow read: if isAdmin() || isSteward();
  allow write: if false;          // CF admin SDK bypasses rules
}

match /topics/{path=**} {
  allow read: if isAuthenticated();
  allow write: if false;          // CF cron only
}
```

### Pattern 4 — Notes (top-level, structured-mem schema)

```javascript
match /notes/{nid} {
  allow get: if isAuthenticated();
  allow list: if isAuthenticated();

  allow create: if isAuthenticated() && notRevoked() && activeTokenMatches()
               && request.resource.data.created_by.uid == request.auth.uid
               && timestampIsServerSet()
               && isValidNote(request.resource.data);

  allow update: if isAdmin() || isSteward()
               || (request.auth.uid == resource.data.created_by.uid
                   && notRevoked()
                   && activeTokenMatches()
                   && withinEditWindow(resource.data.created_at));

  allow delete: if isAdmin();
}
```

### Pattern 5 — Worker docs (admin write, steward edit token rotation)

```javascript
match /workers/{wid} {
  allow read: if isAuthenticated();
  allow create: if isAdmin();
  allow update: if isAdmin()
               || (isSteward() && onlyTokenFieldChanged());    // for re-issue flow
  allow delete: if isAdmin();      // soft-delete preferred
}

function onlyTokenFieldChanged() {
  return request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['active_token_id', 'token_reissued_at']);
}
```

### Pattern 6 — Stale-build rejection (Phase 6 lock)

```javascript
function buildSupported() {
  let minBuild = get(/databases/$(database)/documents/config/min_supported_build).data.value;
  return request.resource.data.app_version >= minBuild;
}

// Apply to all client-write paths:
match /production_entries/{pid} {
  allow create: if /* ... existing checks ... */ && buildSupported();
  allow update: if /* ... existing checks ... */ && buildSupported();
}
```

### Pattern 7 — Default deny

```javascript
match /{document=**} {
  allow read, write: if false;
}
```

## Rationale

| Pattern | Why |
|---|---|
| `authoredBySelf()` on every create | Single most important integrity invariant; no spoofing |
| `timestampIsServerSet()` on create | Closes backdating loophole that would extend edit window |
| `authorAndCreatedAtPinned` on update | Closes Phase 4 G3 vulnerability — author/timestamp rewrite |
| `notRevoked()` always-on for writes | Hybrid revocation tier; instant cutoff at ~0.6% free tier cost |
| `activeTokenMatches()` always-on | Phase 8 lock; kills stolen-phone offline-queue replay |
| `audit_events` server-only | Guarantees no client can fabricate audit history |
| `topics/*` server-only | Topic digest layer is CF-managed; client writes deny |
| Validation in rules + CF | Min-bar (type, range, required, enum) at rules; cross-doc invariants at CF; rejection at write time, not after |
| Default-deny | Failure mode is "access denied," not "data leaked" |

## Acceptance Criteria (the bar)

- [ ] Rules deployed to staging Firebase project; emulator suite passes all tests
- [ ] CI: every PR runs `firebase emulators:exec --only firestore "npm test"` against fixture data
- [ ] Production deploy gated on staging green; rollback plan = previous rules tag
- [ ] Per-collection unit tests: create/update/delete success + failure cases for each role × auth state combination
- [ ] App Check enabled (Play Integrity for handler PWA, reCAPTCHA Enterprise for dashboard); writes from non-attested clients rejected
- [ ] Audit log generation tested: every successful write produces an audit_event via CF post-write trigger
- [ ] Cost monitoring: Cloud Monitoring dashboard shows reads/writes/`get()` calls per minute; alerts on >5x baseline

## Implementation Notes

- Rules language reference: https://firebase.google.com/docs/rules/rules-language
- Test rules locally via `firebase emulators:start --only firestore` + Firestore Rules Playground
- For complex rules, prefer many small helper functions over inline boolean chains; helpers are testable
- Cost monitoring: Cloud Functions admin SDK reads + writes do NOT count against rule `get()` budget (rule budget is per-evaluation, not per-request)
- The `notRevoked()` + `activeTokenMatches()` pattern uses 2 `get()` calls; well within the 10-call limit but watch for additions
- Document every rule change in [SCHEMA_CHANGELOG.md](SCHEMA_CHANGELOG.md) — rules-vs-data skew tracker (Phase 6 must-add)

## Future Considerations

- **Per-customer scoping** — if multi-org, add tenant claim + scope-checked rules
- **Rate limiting in rules** — Firestore doesn't support natively; use App Check + CF middleware
- **Field-level redaction for steward audit reads** — currently steward sees full audit payload; may want to redact sensitive payloads (financial, customer PII) in 2.1
- **Recursive wildcard cleanup** — `topics/{path=**}` recursive wildcard shadows future subcollections; replace with explicit `topics/{tid}` once topic structure stable

## Related

- [AUTH_MODEL.md](AUTH_MODEL.md) — custom claims structure these rules check
- [DATA_HIERARCHY.md](DATA_HIERARCHY.md) — collection structure these rules apply to
- [CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md) — pre-write hooks for cross-doc invariants
- [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) — stale-build rejection + buildSupported() helper
- [../reference/FIRESTORE_RULES.ref.txt](../reference/FIRESTORE_RULES.ref.txt) — actual deployable file

---

*Authored 7 May 2026 by Aurelius.*
