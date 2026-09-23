// Seed reconciliation — makes the SHIPPED config the authority on every
// device, not only on a fresh install.
//
// Why this exists (Janus B-1 / Castor C-H6, 23 Sep 2026): `initData()` seeds
// the roster, area rosters and wage config into localStorage only when the key
// is absent, and every reader prefers the saved copy (`getCfg()` spreads
// `...saved` over DEF_CFG; `getPermWorkers()` loads the saved list). So a
// device first booted before alpha.9 kept `hourRate 41.25`, four men at the
// placeholder ₹496/day (so ₹68.20 OT through permOtRate), and Sambhu on the
// contract list — every rate ruling since 21 Sep reached fresh installs only.
//
// What is authoritative, and why it is safe to overwrite:
//   · prodCfg and prodAreas — written ONLY by initData's seed; no screen edits
//     them. The saved copy is a stale snapshot of old defaults, never an
//     operator's choice. Shipped values win; unknown legacy cfg keys are kept.
//   · Known worker ids (any id in DEF_PERM or DEF_CW) — Settings can ADD a
//     worker but cannot edit an existing one's rate, name or role, so those
//     fields on a saved known-id entry are a stale seed and the shipped entry
//     replaces them. A known id is also removed from the list whose tier it
//     has left (Sambhu, CW → perm, September 2026), or he would be paid twice.
//   · The one operator edit Settings DOES allow on a known worker is
//     deactivate / reactivate (`toggleWorkerActive`), which stamps
//     `deactivatedOn` or `reactivatedOn`. Where the saved entry carries either
//     stamp, its `inactive` flag and stamp fields are the operator's decision
//     and are kept over the shipped value.
//   · Operator-added workers (ids in neither list) are kept untouched, after
//     the shipped ones, in their saved order.
//
// Attendance, advances, production logs and month locks are never touched.
// Pure and idempotent: running it on its own output changes nothing.

const OPERATOR_STATUS = ['inactive', 'deactivatedOn', 'deactivateReason', 'reactivatedOn'];

export function reconcileWorkers(saved, shipped, otherTierShipped) {
  const list = (Array.isArray(saved) ? saved : []).filter((w) => w && w.id);
  const savedById = new Map(list.map((w) => [w.id, w]));
  const shippedIds = new Set(shipped.map((w) => w.id));
  const otherIds = new Set(otherTierShipped.map((w) => w.id));
  const known = shipped.map((w) => {
    const s = savedById.get(w.id);
    const next = { ...w };
    if (s && (s.deactivatedOn || s.reactivatedOn)) {
      for (const f of OPERATOR_STATUS) {
        if (f in s) next[f] = s[f];
      }
    }
    return next;
  });
  const added = list.filter((w) => !shippedIds.has(w.id) && !otherIds.has(w.id));
  return [...known, ...added];
}

export function reconcileCfg(saved, shipped) {
  const base = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  return { ...base, ...clone(shipped) };
}

export function reconcileSeed({ savedPerm, savedCW, savedCfg, defPerm, defCW, defCfg, defAreas }) {
  return {
    perm: reconcileWorkers(savedPerm, defPerm, defCW),
    cw: reconcileWorkers(savedCW, defCW, defPerm),
    cfg: reconcileCfg(savedCfg, defCfg),
    areas: clone(defAreas),
  };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}
