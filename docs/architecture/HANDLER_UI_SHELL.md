# Handler UI Shell

**Phase:** 7
**Status:** LOCKED — 7 May 2026 (8 strengthened locks via 2 MCQ rounds + adversary probe)

---

## Problem

UI shell for the handler PWA — the primary data ingestion surface in alpha. Workers are semi-literate Hindi/regional speakers, gloved + sleeved, in 85dB ambient noise, dim shop lighting, intermittent signal, occasional acid splash. The shell has to make data capture *fast, accurate, complete, reliable, forensically attributable, recoverable, and adoption-friendly* (see [EXCELLENT_DATA_CAPTURE.md](EXCELLENT_DATA_CAPTURE.md) for the bar).

## Adversarial Findings

6 BLOCKER + 11 HIGH + 4 MEDIUM. Most relevant to shell:

- **BLOCKER** — Touch targets undefined; gloved+sleeved finger needs 64px floor (vs typical 44px)
- **BLOCKER** — i18n not deferred work; needs Devanagari + icons + audio TTS day-one
- **BLOCKER** — iOS Safari PWA storage eviction; Android-only resolution
- **HIGH** — Audio confirmation needed (toast invisible in dim/noisy/sweaty environment)
- **HIGH** — Acid splash + screen wake = form state lost without auto-save
- **HIGH** — Typeahead wrong primitive for gloved workers; need big-button picker grid
- **HIGH** — Offline indicator color-only chip too abstract; need explicit copy

All addressed.

## Locked Decision

### Three-layer screen hierarchy

```
┌──────────────────────────────────────────────────────────┐
│ TOP BAR (~48px, always visible)                          │
│ ●14:32 · Shift M · Ramesh (handler) · ●synced · ⚙       │
│         (clock) (shift) (worker)      (sync) (settings)  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ HOME (form picker)                                       │
│                                                          │
│   ┌──────┐ ┌──────┐ ┌──────┐                             │
│   │ 📋   │ │ 🏭   │ │ 🔬   │                             │
│   │ Job  │ │ Prod │ │ DFT  │                             │
│   │Recpt │ │Entry │ │ Meas │                             │
│   └──────┘ └──────┘ └──────┘                             │
│   ┌──────┐ ┌──────┐ ┌──────┐                             │
│   │ 🚚   │ │ 📦   │ │ 🔧   │                             │
│   │Disp  │ │Stock │ │Mach  │                             │
│   └──────┘ └──────┘ └──────┘                             │
│   ┌──────┐ ┌──────┐ ┌──────┐                             │
│   │ ⏱    │ │ 📝   │ │      │                             │
│   │Check │ │ Note │ │      │                             │
│   │ in   │ │      │ │      │                             │
│   └──────┘ └──────┘ └──────┘                             │
│                                                          │
│ Recent Entries (last 10) ──────────────────────          │
│   • 14:30 · Production · J-1042 · T1 · 250 pcs · ✓      │
│   • 14:18 · Check-in · self · started shift · ✓          │
│   • 14:05 · Note · T1 · "humming sound" · ⏳ queued      │
│   • ...                                                  │
└──────────────────────────────────────────────────────────┘
```

**Per-form screens** (Layer 3):

```
┌──────────────────────────────────────────────────────────┐
│ ← Back · Production Entry                                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Job:  [J-1042 ABC Industries] [change]                  │
│        ↑ pre-filled from last entry, "still J42?"        │
│        microcopy in pulsing border                       │
│                                                          │
│ Machine: [T1 (VAT Room 1)] [change]                     │
│                                                          │
│ Worker: [Ramesh (self)] [change]                        │
│                                                          │
│ Quantity: [____] pcs                                     │
│           ↑ Devanagari numpad on focus                   │
│                                                          │
│ Station: [Plating ▾]                                    │
│                                                          │
│ Notes (optional):                                        │
│ [_______________________]                                │
│                                                          │
│ [Cancel]              [Submit & continue]                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Universal form template

Defined once in component library; consumed by every form:

- Field 1, 2, 3... with labels (Devanagari primary + English secondary toggle)
- Each field: ≥64px touch target; large input area; iconography on field icon
- Smart defaults from prior entry (with full pre-fill defense bundle)
- Inline Zod validation (errors surface in-field with high contrast + icon)
- Notes (always optional, free text)
- Submit & continue (Production-frequency forms) OR Submit & return (one-off forms)
- Multi-modal submit confirmation: toast + haptic + distinct audio cue (frequency outside machine noise band, ISO 7731 inverted)
- Form draft auto-save to IndexedDB on every keystroke (defends against acid-splash screen-wake state loss)
- Idempotency key (UUID) generated on form open; sent with submit; server dedups ±5min window

### Sync chip detail

```
●synced     · green dot · all writes committed
⏳syncing 4 · blue spinner · CF cron in flight
●offline 7  · orange icon · 7 writes queued in IndexedDB
●reject 1   · red icon · 1 write rejected (steward inbox)
```

Click chip → "Sync status" sheet:
- Saved on phone, not yet sent (4): list of queued writes
- Last successful sync: 14:18
- Network status: offline
- Actions: [Sync now] [Hold]

### Pre-flush confirmation (Phase 5 lock)

App open detects queued writes → modal:

```
┌──────────────────────────────────────┐
│ 7 writes pending sync                │
│ Since: 13 May 09:12 (3 hours ago)    │
│                                      │
│ Production Entry × 5                 │
│ Note × 1                             │
│ Stock Refill × 1                     │
│                                      │
│ [Review] [Sync now] [Hold]           │
└──────────────────────────────────────┘
```

Worker confirms; flush proceeds. Catches reinstall scenarios where queue is unexpected.

### i18n implementation (Phase 7 BLOCKER fix)

- **Labels:** Devanagari primary, English secondary toggle in settings
- **Iconography:** every primary action carries an icon (📋 job receipt, 🏭 production, 🔬 DFT, 🚚 dispatch, 📦 stock, 🔧 machine, ⏱ check-in, 📝 note)
- **TTS:** long-press any field label → reads label in Hindi via Web Speech API (with fallback to recorded MP3 for older Android)
- **Numbering:** Indian (lakh/crore) for currency in stock refill; standard for quantities
- **Date format:** dd/mm/yyyy with Devanagari month names option
- **Right-to-left reading:** N/A (Devanagari is LTR like English)

### 64px touch target enforcement

```css
:root {
  --tap-target-min: 64px;
}

button, .tile, .field-action, .picker-row {
  min-height: var(--tap-target-min);
  min-width: var(--tap-target-min);
}

.numpad-key { min-height: 80px; min-width: 80px; }   /* extra-large for numeric */
```

Component library exposes these as CSS custom properties; enforced via CSS-in-JS or PostCSS plugin checking compiled output.

### Offline-state copy

Replace color-only chip with explicit text:

- "✓ All writes synced"
- "⏳ Syncing 4 writes..."
- "⚠️ Saved on phone, not yet sent (7)"
- "🔴 1 write rejected by server (see Steward)"

Multi-modal: color + icon + text. Not color-alone.

### Multi-modal submit confirmation

On successful submit:

1. **Visual:** brief toast (bottom of screen, Devanagari "Saved · सेव हो गया") for 2 seconds
2. **Haptic:** short vibration (50ms) via Vibration API
3. **Audio:** distinct frequency tone (e.g., 880Hz for 100ms) outside machine noise band; configurable via settings to mute or change

### Form draft auto-save

```typescript
// In every form component
useEffect(() => {
  const saveDraft = debounce(() => {
    indexedDB.set(`draft_${formType}_${idempotencyKey}`, formState);
  }, 200);  // every 200ms
  saveDraft();
}, [formState]);

useEffect(() => {
  // On form open, check for existing draft
  const draft = indexedDB.get(`draft_${formType}_${idempotencyKey}`);
  if (draft) {
    showDialog('Resume previous entry?', {
      yes: () => setFormState(draft),
      no: () => { /* clear and start fresh */ }
    });
  }
}, []);
```

Draft auto-cleared on successful submit OR on explicit cancel.

### Big-button picker grid

For high-frequency fields (job, machine, worker):

```
┌────────────────────────────────────────────┐
│  Recent jobs (last shift)                  │
│  ┌──────┐ ┌──────┐ ┌──────┐               │
│  │ ABC  │ │ XYZ  │ │ DEF  │               │
│  │J-1042│ │J-1041│ │J-1038│               │
│  │  P   │ │  S   │ │  P   │               │
│  └──────┘ └──────┘ └──────┘               │
│  ┌──────┐ ┌──────┐ ┌──────┐               │
│  │ ABC  │ │ ...  │ │      │               │
│  └──────┘ └──────┘ └──────┘               │
│                                            │
│  [🔍 Search older jobs] (typeahead fallback)│
└────────────────────────────────────────────┘
```

Each card: ≥120×80px tap target; customer name in Devanagari; last-3-digits of job ID; tier indicator (P=premium, S=standard); colored band by client tier; icon for plating method (V=VAT, B=Barrel).

Cards sourced from local IndexedDB cache (recent + frequent in last 7 days); typeahead fallback hits local cache, never server-dependent.

## Rationale

- **Three-layer screen hierarchy** reduces cognitive load — top bar always shows status, home is a form picker, per-form screens are focused
- **Universal form template** = consistent UX across all 9 forms; component library reduces drift
- **64px touch target** = closes the 10-20% mis-tap rate on gloved hands
- **Multi-modal confirmation** = closes the silent-toast invisibility hole
- **Form draft auto-save** = closes the screen-wake state-loss hole
- **Explicit offline copy** = workers don't have to interpret colors; "Saved on phone, not yet sent (7)" is unambiguous
- **Big-button picker grid** = closes the typeahead-needs-typing hole for gloved workers
- **i18n (Devanagari + icons + TTS)** = closes the English-only adoption hole

## Acceptance Criteria (the bar)

- [ ] PWA installable on Android (Chrome + Firefox tested) at `/sep-dashboard/entry/handler/`
- [ ] All 9 form screens implement universal template
- [ ] 64px touch target enforced via CSS tokens; verified via automated UI test
- [ ] Devanagari labels primary; English toggle in settings; long-press TTS works
- [ ] Multi-modal submit confirmation: toast + haptic + audio cue verified on real device
- [ ] Form draft auto-save: state recovers on screen-wake / accidental tab close
- [ ] Big-button picker grid for job/machine/worker: 64px+ cards; recent-first; typeahead fallback
- [ ] Sync chip + queued counter + pre-flush confirmation: tested with offline-then-online flow
- [ ] Explicit offline copy ("Saved on phone, not yet sent (X)"); no color-only chips
- [ ] Recent Entries log on home: last 10, with ⏳ icon for queued items
- [ ] iOS Safari handler officially unsupported (per Phase 7); documented in HANDLER_PROVISIONING

## Implementation Notes

- Build entry: `src/handler/main.js` → bundles to `/sep-dashboard/entry/handler/`
- React or vanilla? — defer to Stage F decision; component library should be framework-agnostic enough
- Web Speech API (TTS): fallback to recorded MP3s for older Android (devices without Hindi TTS)
- Vibration API: feature-detect; silent fallback if unavailable
- Audio cue: use Web Audio API to generate tone; configurable frequency/volume in settings
- Form schemas: Zod (per Phase 6); colocate schema with form component
- Big-button picker cards: render as React components; props from local IndexedDB cache
- IndexedDB access: use a wrapper library (idb-keyval) for simplicity; storage Layer 2 abstracts further

## Future Considerations

- **Voice notes** (Phase 2.1+) — currently structured note form only; add voice attachment field for non-handler workers
- **Camera scan** for QR codes on customer parts (Phase 2.1+) — instant job ID lookup
- **Biometric unlock** (Phase 2.2+) — fingerprint to open PWA
- **Multi-tab on dashboard** — handler PWA is intentionally single-flow; not relevant
- **Offline-first form drafts** — draft persistence currently per-form-instance; could persist across PWA reinstalls if exported

## Related

- [HANDLER_FORMS.md](HANDLER_FORMS.md) — field-level form spec
- [DEPLOY_TOPOLOGY.md](DEPLOY_TOPOLOGY.md) — N-PWA pattern; subpath
- [HANDLER_PROVISIONING.md](HANDLER_PROVISIONING.md) — what handler sees post-provisioning
- [ADOPTION_PLAN.md](ADOPTION_PLAN.md) — onboarding workflow uses this UI
- [EXCELLENT_DATA_CAPTURE.md](EXCELLENT_DATA_CAPTURE.md) — the bar this UI is measured against

---

*Authored 7 May 2026 by Aurelius.*
