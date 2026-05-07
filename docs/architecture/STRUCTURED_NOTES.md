# Structured Notes (Notes-as-Memory)

**Phase:** 2 (refined post-research)
**Status:** LOCKED — 7 May 2026
**Influenced by:** Pocock skills convention (markdown + frontmatter + agent-readable description); Karpathy "context is the program" + LLM Wiki pattern

---

## Problem

Notes attached to entities (machines, jobs, workers, customers, etc.) need to be more than free-text strings. They need structure that makes them: queryable (steward inbox by severity / status / topic), actionable (typed lifecycle), agent-consumable (every note routable to an aggregator page), forensic (append-only revisions). Closed enums rot; free-text degrades; structured-mem gives durable observability.

## Options Considered

**Option A — Free-text body + author + timestamp + resolved_at.**
- Simple; low schema overhead
- Not queryable beyond entity attachment
- Can't drive steward inbox or operational signals

**Option B — Closed `note_type` enum + severity (5-tier) + status (5-tier).**
- More structure; supports filtering
- Enums rot when new domain needs surface (every new note kind = schema migration)
- 5-tier severity / status are theatrical; operators won't use the middle three

**Option C — Open `kind` discriminator + agent-readable summary + collapsed status (3) + collapsed priority (2) + revisions[] + typed links + expiry.**
- Schema survives domain growth via open discriminator
- Mandatory `summary` field is the agent-routing surface
- Append-only revisions preserve forensic trail
- Typed links express semantic relationships

## Adversarial Findings

Phase 2 was informed by external research (`pocock-agents` repo + Karpathy's agentic engineering writings) rather than an adversary probe. Synthesized recommendations:

- Closed `note_type` enum will rot — switch to open `kind` + `data: Record<string,unknown>` payload
- Severity 5-tier is theatre — collapse to 2 (`normal | urgent`)
- Status 5-tier is theatre — collapse to 3 (`active | resolved | archived`)
- `related_note_ids` flat array is graph-poor — switch to typed `links: NoteLink[]`
- Missing: `summary` (agent-readable trigger); `revisions[]` (append-only history); `expires_at` (time-bounded notes)

All folded into Option C.

## Locked Decision

```typescript
// Layer 1 — Firestore-friendly structured record
interface NoteRecord {
  id: string;
  __schema_version: number;          // Phase 6 migration discipline

  // Routing
  topic_refs: TopicRef[];            // entities this note attaches to (array-contains queryable)
  summary: string;                    // ≤120 chars, "Use when..." voice (Pocock skill description pattern)
  body_md: string;                    // full markdown body
  kind?: string;                      // open discriminator (e.g., 'maintenance-flag', 'customer-preference')
  data?: Record<string, unknown>;     // discriminated payload per kind (open, extensible)

  // Lifecycle
  status: 'active' | 'resolved' | 'archived';
  priority?: 'normal' | 'urgent';
  expires_at?: Timestamp;             // intrinsically time-bounded notes

  // Routing surface
  tags: string[];                     // free-form additional routing
  links: NoteLink[];                  // typed semantic links to other notes

  // Audit
  created_by: UserRef;
  created_at: Timestamp;              // server-set per Phase 4 timestamp pinning
  revisions: Revision[];              // append-only; resolution = a revision

  // Provenance
  source: 'handler' | 'dashboard' | 'cf-anomaly' | 'cf-rule' | 'external';
  app_version: string;                // build hash from esbuild
}

interface Revision {
  at: Timestamp;
  by: UserRef;
  change: 'created' | 'updated' | 'resolved' | 'reopened' | 'archived' | 'priority-changed';
  body_diff?: string;                 // markdown diff from prior body
  resolution_note?: string;
  reason?: string;                    // for status changes
}

interface NoteLink {
  to_note_id: string;
  type: 'supersedes' | 'caused-by' | 'related-to' | 'duplicate-of';
}

interface TopicRef {
  entity_type: 'machine' | 'worker' | 'job' | 'customer' | 'stock' | 'room' | 'corridor' | 'inspection-station';
  entity_id: string;
}

interface UserRef {
  uid: string;
  display_name: string;               // denormalized; updated on user rename via CF
}
```

### Storage location

Top-level Firestore collection only: `/notes/{nid}` (per Phase 4 hierarchy refinement; no per-entity subcollection mirrors).

### Open discriminator examples (`kind` + `data` payload)

```typescript
// kind: 'maintenance-flag'
{ kind: 'maintenance-flag',
  data: { suspected_part: 'anode', severity_estimate: 'medium', last_inspected_at: ... } }

// kind: 'customer-preference'
{ kind: 'customer-preference',
  data: { dft_target_high: 12, finish: 'matte', urgency_threshold_h: 18 } }

// kind: 'anomaly'
{ kind: 'anomaly',
  data: { detected_by: 'cf-2sigma', metric: 'qty_pcs', expected: 850, actual: 1200 } }

// kind: 'safety-concern'
{ kind: 'safety-concern',
  data: { ppe_missing: ['gloves'], area: 'pickling-area-4', urgency: 'high' } }
```

The `kind` enum is documentation, not validation. Adding a new kind requires updating the enum docs in [../reference/SCHEMA.md](../reference/SCHEMA.md), but no rule or schema migration is needed.

## Rationale

- **Open discriminator** survives domain growth: new note kinds (`safety-concern`, `process-improvement`, `quality-concern`) just add to the docs without touching rules or migrations.
- **Mandatory `summary`** is the agent-routing surface; modeled on Pocock's skill `description` field. An agent (or a steward inbox UI) reading 200 customer notes can filter on summary alone without scanning bodies.
- **Append-only revisions** replace destructive `resolution_*` fields. Composes with audit log (one revision = one audit event). Forensic recovery: every prior state of a note is recoverable.
- **Typed links** distinguish "T3 caused-by yesterday's anode wear" from "T3 supersedes T2's old issue note." Powers cross-note graph traversal in topic digests.
- **`expires_at`** prevents time-bounded observations ("VAT 2 acting weird this week") from accumulating forever and poisoning the topic.
- **Provenance fields** (`source`, `app_version`) enable forensic correlation — "this note came from a handler running v2.0.4 — explains the field shape."

## Acceptance Criteria (the bar)

- [ ] Zod schema validates every note write at storage Layer 2 (per Phase 6)
- [ ] `topic_refs` indexed for array-contains queries
- [ ] `summary` field max-length enforced at 120 chars
- [ ] Revisions append on every status change, body edit, priority change; never destructively overwrite prior state
- [ ] `expires_at` honored: notes auto-archived (status → `archived`) by daily CF when past expiry
- [ ] Topic digest CF compiles per-entity note sections from `topic_refs` queries (see [TOPIC_DIGESTS.md](TOPIC_DIGESTS.md))
- [ ] Steward inbox UI filters by status / priority / kind / tags / aged-since-created (per [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md))

## Implementation Notes

- The structured note form (handler-side) maps fields 1:1 to NoteRecord shape; required fields = topic_refs (multi-attach picker), summary (single-line input), body_md (textarea), priority (toggle), kind (typeahead with suggested kinds)
- `kind` typeahead suggests existing kinds from prior notes; user can type new
- Voice-note primitive was REJECTED in Phase 7 (notebook handler is the literate steward who structures observations on workers' behalf); keep the structured form as primary
- TopicRef.entity_id must reference an existing entity; CF post-write hook validates dangling refs and surfaces in anomaly inbox if invalid (per [ANOMALY_INBOX.md](ANOMALY_INBOX.md))

## Future Considerations

- **Cross-note graph rendering** — visualize the link graph in steward inbox (which notes supersede / caused-by / related-to which)
- **Note expiry recommendations** — CF suggests `expires_at` based on note kind (maintenance-flag default 30d; customer-preference default null/permanent)
- **Voice attachment per note** (Phase 2.1) — optional audio file uploaded with note; transcribed to body_md by CF
- **Note templates** — pre-filled forms for common note kinds (maintenance-flag template auto-fills suspected_part field, etc.)

## Related

- [DATA_HIERARCHY.md](DATA_HIERARCHY.md) — top-level collection placement
- [TOPIC_DIGESTS.md](TOPIC_DIGESTS.md) — how notes get compiled into per-entity wiki pages
- [HANDLER_FORMS.md](HANDLER_FORMS.md) — Form #9 (Note) field-level spec
- [STEWARD_AFFORDANCES.md](STEWARD_AFFORDANCES.md) — steward inbox uses summary/status/priority for routing
- [ANOMALY_INBOX.md](ANOMALY_INBOX.md) — auto-generated anomaly notes via `kind: 'anomaly'`
- [../reference/SCHEMA.md](../reference/SCHEMA.md) — canonical entity reference

---

*Authored 7 May 2026 by Aurelius.*
