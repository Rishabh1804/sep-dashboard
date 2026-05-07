# Topic Digests (Bifurcated Read/Write Surface)

**Phase:** 2
**Status:** LOCKED — 7 May 2026
**Influenced by:** Pocock skills convention; Karpathy "context is the program" + LLM Wiki pattern

---

## Problem

Operational data lives in Firestore (live, real-time, offline-first) — perfect for app consumers, problematic for *agent* consumers. Aurelius (across sessions), Claude Code, future contractors, and humans browsing the repo all need to consume operational state. RAG-on-blobs against Firestore is a step backward from a curated, git-versioned knowledge layer. Need a second surface that's agent-consumable, forensic, and portable.

## Options Considered

**Option A — Live-only.** Everything reads directly from Firestore. Real-time + offline-first; no agent surface; no portable / forensic copy.

**Option B — File-only.** Everything reads from compiled markdown. Agent-friendly + portable; loses real-time + offline-first. Impossible for live operation.

**Option C — Bifurcated.** Firestore for live writes/reads (operator UI); compiled markdown digests (`topics/*.md`) for agent / forensic / portable consumption. Two surfaces, two consumers.

## Adversarial Findings

Pattern emerged from Pocock skills + Karpathy research. Specific shape:

- Per-topic markdown digest (`topics/machines/t-1-1.md`) compiled from Firestore on a schedule
- Frontmatter (topic name, last_updated, open_count, urgent_count) + sections (active urgent / active normal / resolved log / archived) + chronological history
- Top-level `topics/INDEX.md` as routing surface (modeled on Pocock's `setup-matt-pocock-skills` agent-skills list)
- Refresh cadence trade-off: on-write (most engineering, freshest) vs hourly cron (moderate, ratified) vs daily (cheapest, too stale)

## Locked Decision

**Bifurcated read/write surfaces (Option C)** with **hourly cron refresh** (per Phase 2 ratification).

### File structure

```
docs/topics/
├── INDEX.md                          ← routing surface; one line per topic
├── machines/
│   ├── t-1-1.md                      ← VAT plating tank T1 in VAT Room 1
│   ├── t-1-2.md
│   └── ...
├── jobs/
│   ├── J-2026-1042.md
│   └── ...
├── customers/
│   ├── abc-industries.md
│   └── ...
├── workers/
│   ├── w-001.md
│   └── ...
├── stock/
│   ├── zinc-anode.md
│   └── ...
├── rooms/
│   ├── vat-room-1.md
│   └── ...
└── corridors/
    └── perimeter-segment-3.md
```

### Per-topic file structure

```markdown
---
topic_type: machine
topic_id: t-1-1
display_name: VAT Plating Tank T1 (VAT Room 1)
last_updated: 2026-05-07T12:00:00Z
last_updated_by: cf-topic-digest-cron
schema_version: 1
open_notes_count: 2
urgent_notes_count: 1
status: running
health_score: 78
---

# VAT Plating Tank T1 (VAT Room 1)

## Current State

- **Status:** running
- **Job in progress:** [J-2026-1042](../jobs/J-2026-1042.md) (ABC Industries, M8 hex bolts)
- **Quality tier:** standard
- **Started:** 2026-05-07 11:42 (18 min in)
- **Last maintained:** 2026-04-15 (22 days ago)

## Active Notes (2)

### 🔴 Urgent — anode wear suspected
**Summary:** Use when planning Tank T1 maintenance — anode replacement may be needed within 1 week
**Kind:** maintenance-flag · **Priority:** urgent · **Status:** active
**Reported by:** Handler (w-003) · 2026-05-06 14:22
T1 making intermittent humming noise during plating cycle. Worker Ramesh reported reduced bath
turbulence and possible anode contact issue. Recommend visual inspection at next maintenance
window.

### 🟢 Normal — bath chemistry monitor
**Summary:** Use when scheduling bath dips — chemistry slightly trending toward zinc-low
**Kind:** observation · **Priority:** normal · **Status:** active
**Reported by:** Steward · 2026-05-04 09:15
...

## Recent Production (last 7 days, 24 entries)

| Date | Job | Customer | Worker | qty_pcs | Notes |
|---|---|---|---|---|---|
| 2026-05-07 | J-2026-1042 | ABC Industries | w-003 | in-flight | — |
| 2026-05-06 | J-2026-1041 | XYZ Hardware | w-002 | 1,247 | DFT pass 10.2µm avg |
| ... | | | | | |

## State Transitions (last 14 days, 8 events)

| When | From → To | Trigger | Actor |
|---|---|---|---|
| 2026-05-07 11:42 | idle → running | job J-1042 loaded | w-003 |
| 2026-05-07 11:30 | running → idle | job J-1040 unloaded | w-003 |
| ... | | | |

## Resolved / Archived Notes (3, last 30 days)

- ✅ 2026-04-22 — bath chemistry rebalanced after pH drift (resolved by Steward)
- ✅ 2026-04-18 — false alarm on temperature sensor (archived; sensor recalibrated)
- ✅ 2026-04-10 — anode rotation completed (resolved on schedule)

## Cross-References

- **In Room:** [VAT Room 1](../rooms/vat-room-1.md)
- **Recent operators:** [w-003](../workers/w-003.md), [w-002](../workers/w-002.md), [w-001](../workers/w-001.md)
- **Recent customers:** [ABC Industries](../customers/abc-industries.md), [XYZ Hardware](../customers/xyz-hardware.md)
- **Bath chemistry stock:** [zinc-anode](../stock/zinc-anode.md), [sodium-cyanide](../stock/sodium-cyanide.md)
```

### Top-level INDEX.md

```markdown
# Topics — Routing Surface

**Last refreshed:** 2026-05-07T12:00:00Z (hourly cron)

## Machines (24 total)

- **Plating tanks** (5 active, 1 dysfunctional T2)
  - [t-1-1.md](machines/t-1-1.md) — T1 (VAT Room 1) · running · 2 active notes (1 urgent)
  - [t-1-2.md](machines/t-1-2.md) — T2 (VAT Room 1) · DOWN · 1 active note
  - ...
- **Staging tanks** (5)
- **Passivation tanks** (4)
- **Drum/rinse dips** (3)
- **Pickling tanks** (6)
- **Pickling dip tanks** (2)
- **Plating barrels** (8)
- **Inspection station** (1)
- **Dryer** (1, shared)

## Jobs (active)

- [J-2026-1042.md](jobs/J-2026-1042.md) — ABC Industries · in-flight · plating · 18 min in
- [J-2026-1041.md](jobs/J-2026-1041.md) — XYZ Hardware · ready · awaiting dispatch
- ...

## Customers (with open jobs)

- [abc-industries.md](customers/abc-industries.md) — 2 open jobs · health 82
- ...

## Stock (low or critical)

- 🔴 [zinc-anode.md](stock/zinc-anode.md) — 23kg / threshold 50kg
- 🟠 [sodium-cyanide.md](stock/sodium-cyanide.md) — 8L / threshold 10L
- ...

## Workers (on shift)

- [w-001.md](workers/w-001.md) — Notebook Handler · in office · last entry 2 min ago
- [w-003.md](workers/w-003.md) — VAT Operator (Room 1) · at T1 · last entry 1 min ago
- ...
```

### Refresh mechanism

Cloud Function `topicDigestCron`:

- **Schedule:** every hour at :00
- **Min-instances:** 1 (always-warm; per Phase 5 cold-start lock)
- **Process:**
  1. Query Firestore for entities updated in last 1h + open notes attached to them
  2. For each affected topic, regenerate the markdown file from current state
  3. Update INDEX.md with summary line per topic
  4. Commit changes to repo via GitHub API (using PAT stored in Firebase secrets)
  5. Push to main branch with commit message `chore(topics): hourly digest refresh {timestamp}`
- **Failure mode:** if commit fails (rate limit, auth, conflict), log to audit; retry next hour; surface in steward anomaly inbox if 3 consecutive failures

## Rationale

- **Two consumers, two surfaces** — operators need real-time + offline-first; agents need durable + portable + git-versioned. Don't try to make one surface serve both.
- **Hourly cadence** chosen over on-write (too much CF cost) and daily (too stale for live agent consumption). Hourly = up to 1h staleness on agent surface; live operator UI bypasses this entirely via Firestore listeners.
- **Markdown over JSON** for the agent surface — Pocock + Karpathy converge here; markdown is the programming language for agents; humans + agents read the same artifact in the same format.
- **Per-topic granularity** — one file per entity. Aurelius reading `topics/machines/t-1-1.md` gets everything about that machine in one place; Claude Code reviewing pull request reads only relevant topics.
- **Git-versioned** — every hourly commit is a snapshot; bisect operational state at any past hour; portable repo backup of all operational data.

## Acceptance Criteria (the bar)

- [ ] Cron CF runs hourly successfully; commits to main branch with conventional message
- [ ] INDEX.md regenerated each cycle with current entity counts + status summaries
- [ ] Per-topic file generated for every entity that has notes OR has been touched in last 7 days
- [ ] Inactive entities (no notes + no activity 30d) excluded from rolling refresh; manually surfaced via admin function if needed
- [ ] CF idempotent — running it twice in a row produces same output (sorted, deterministic order)
- [ ] First-run end-to-end test: machine t-1-1 has 2 notes + recent activity → topics/machines/t-1-1.md generated correctly with all sections populated
- [ ] CF failure mode tested: simulated GitHub rate limit → audit event logged + steward anomaly notification

## Implementation Notes

- Use Firebase Functions Secret Manager for GitHub PAT
- Commit message format: `chore(topics): hourly digest refresh {ISO-8601 timestamp}` — diffable, sortable
- Sort all sections deterministically (most-recent-first within categories) so successive runs produce diff-able commits when nothing changed (commit-skip if no diff)
- For high-volume topics (jobs with 1000+ production_entries), paginate "Recent Production" to last 50 entries; older ones excerpted into a "Historical" section linked to a separate file
- Frontmatter is YAML; use a templating library that handles escaping (e.g., js-yaml)
- Cross-references between topic files are relative paths so they work both on GitHub web view and in local clones

## Future Considerations

- **Real-time topic updates** (Phase 2.1+) — replace cron with Firestore listener that updates topic on any source-doc change; would require careful debouncing to avoid commit storms
- **Topic digest agent integration** — Aurelius / Claude Code skill that reads `topics/INDEX.md` first, then drills into specific topics on demand
- **Per-customer portal** (Phase 2.2+) — public-facing customer portal could derive its UI from `topics/customers/{id}.md` directly
- **Time-travel** — git history of `topics/` is already a time-travel artifact; build a "show me topic state on date X" admin tool that checks out historical commit
- **Dispute resolution forensics** — when a customer disputes a job, render `topics/jobs/{id}.md` from a specific commit timestamp as legal-grade artifact

## Related

- [DATA_HIERARCHY.md](DATA_HIERARCHY.md) — Firestore source of truth for these digests
- [STRUCTURED_NOTES.md](STRUCTURED_NOTES.md) — note records that get compiled into topic sections
- [CLOUD_FUNCTION_HOOKS.md](CLOUD_FUNCTION_HOOKS.md) — `topicDigestCron` implementation
- [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) — how schema changes ripple through topic digest output

---

*Authored 7 May 2026 by Aurelius.*
