# Topics — Routing Surface (Stub)

**Status:** PLACEHOLDER (populated post-launch by hourly cron)
**First population:** When Phase 2.0 alpha ships and `topicDigestCron` Cloud Function runs its first hourly cycle.

---

## What This Will Become

After alpha launch, this file is regenerated hourly by [`topicDigestCron`](../architecture/CLOUD_FUNCTION_HOOKS.md) — a routing surface for per-entity wiki digests compiled from Firestore data.

Per [`docs/architecture/TOPIC_DIGESTS.md`](../architecture/TOPIC_DIGESTS.md), this index will list every topic (machine / job / customer / worker / stock / room / corridor) with:
- One-line summary
- Status indicator
- Open notes count (urgent count if urgent notes exist)
- Last activity timestamp
- Cross-link to the per-topic markdown digest in `docs/topics/{type}/{id}.md`

---

## Why This Stub Exists

So that:
1. The directory `docs/topics/` exists in the repo before alpha launch (esbuild + git tracking)
2. The hourly cron CF has a target file to overwrite/append to
3. Aurelius / Claude Code / contractors visiting the repo see the structure

---

## Per-Topic File Format

Each per-topic file follows the structure documented in [`docs/architecture/TOPIC_DIGESTS.md`](../architecture/TOPIC_DIGESTS.md):

- YAML frontmatter (topic_type, topic_id, last_updated, open_notes_count, etc.)
- Current State section
- Active Notes (urgent / normal)
- Recent Production / DFT / Dispatch (entity-relevant)
- State Transitions (if applicable)
- Resolved / Archived Notes
- Cross-References to related topics

Cross-links use relative paths so they work both on GitHub web view and in local clones.

---

## Read by

- **Aurelius across Cowork sessions** — operational state context for project decisions
- **Claude Code during Stage F** — context for code work touching specific entities
- **Future contractors** — onboarding artifact; "what does this floor look like?"
- **Any agent reading repo state** — Karpathy LLM Wiki pattern realized

---

## When This File Updates

After Phase 2.0 alpha ships:
- Hourly cron runs `topicDigestCron` CF
- CF queries Firestore for entities updated in last 1h + open notes
- Regenerates affected topic files + this INDEX
- Commits to `main` branch with message `chore(topics): hourly digest refresh {timestamp}`
- If no diff (nothing changed), commit is skipped

---

## Related

- [`../architecture/TOPIC_DIGESTS.md`](../architecture/TOPIC_DIGESTS.md) — full design
- [`../architecture/CLOUD_FUNCTION_HOOKS.md`](../architecture/CLOUD_FUNCTION_HOOKS.md) — `topicDigestCron` implementation
- [`../architecture/STRUCTURED_NOTES.md`](../architecture/STRUCTURED_NOTES.md) — note records that become topic sections
- [`../reference/SCHEMA.md`](../reference/SCHEMA.md) — entity types that become topics

---

*Stub initialized 7 May 2026 by Aurelius. Will be programmatically replaced post-alpha launch.*
