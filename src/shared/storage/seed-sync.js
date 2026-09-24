// Seed reconciliation and the roster import door.
//
// Two authorities, split by kind of data (Director's sensitive-data rule,
// 24 Sep 2026 — business data never enters this public repo):
//
//   · STRUCTURE ships with the app and wins on every boot: which ids exist,
//     their display names, roles, tier, pay model and shift length, the area
//     rosters, and the pay rules in DEF_CFG. `initData()` used to seed these
//     only when absent, so an existing device never saw a correction; they are
//     reconciled on every boot instead.
//   · PAY DATA — each worker's dailyRate / monthlyWage and the rate-card fields
//     in DEF_CFG (RATE_CFG_FIELDS) — never ships. It arrives through Settings →
//     Import roster, from a file soma-internal generates. Reconciliation never
//     touches it: a device keeps the rates it holds (a transfer is a COPY), and
//     only an import replaces them.
//
// Also preserved: operator-added workers (ids in neither shipped list), and an
// operator's deactivate/reactivate, which the app stamps. A known id is removed
// from the tier it has left, so a worker who changed tier is never paid twice.
// Attendance, advances, production logs and month locks are never touched.
// Every function here is pure; running one on its own output changes nothing.

import { RATE_CFG_FIELDS } from '../config/wage.js';

const OPERATOR_STATUS = ['inactive', 'deactivatedOn', 'deactivateReason', 'reactivatedOn'];
export const RATE_WORKER_FIELDS = ['dailyRate', 'monthlyWage'];

const isRate = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export function reconcileWorkers(saved, shipped, otherTierShipped) {
  const list = (Array.isArray(saved) ? saved : []).filter((w) => w && w.id);
  const savedById = new Map(list.map((w) => [w.id, w]));
  const shippedIds = new Set(shipped.map((w) => w.id));
  const otherIds = new Set(otherTierShipped.map((w) => w.id));
  const known = shipped.map((w) => {
    const s = savedById.get(w.id);
    const next = { ...w };
    if (s) {
      for (const f of RATE_WORKER_FIELDS) if (isRate(s[f])) next[f] = s[f];
      if (s.deactivatedOn || s.reactivatedOn) {
        for (const f of OPERATOR_STATUS) if (f in s) next[f] = s[f];
      }
    }
    return next;
  });
  const added = list.filter((w) => !shippedIds.has(w.id) && !otherIds.has(w.id));
  return [...known, ...added];
}

export function reconcileCfg(saved, shipped) {
  const base = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const next = { ...base, ...clone(shipped) };
  for (const f of RATE_CFG_FIELDS) next[f] = isRate(base[f]) ? base[f] : shipped[f];
  return next;
}

export function reconcileSeed({ savedPerm, savedCW, savedCfg, defPerm, defCW, defCfg, defAreas }) {
  return {
    perm: reconcileWorkers(savedPerm, defPerm, defCW),
    cw: reconcileWorkers(savedCW, defCW, defPerm),
    cfg: reconcileCfg(savedCfg, defCfg),
    areas: clone(defAreas),
  };
}

// ── The roster import door ──────────────────────────────────────────────────
// File format, produced by soma-internal `scripts/build-dashboard-roster.py`:
//   { "format": "sep-dashboard-roster", "version": 1, "asOf": "YYYY-MM-DD",
//     "cfg": { "hourRate": n, "permOtBaseRate": n, "snackRate": n },
//     "workers": [ { "id": "...", "dailyRate": n } | { "id": "...", "monthlyWage": n } ] }
// Workers are matched by id — never by name — across both tiers. An id this
// device does not hold is SKIPPED and COUNTED, never created: inventing a
// worker would put a row with no tier on the roster. Only rate fields are
// applied; structure stays the app's.
export const ROSTER_FORMAT = 'sep-dashboard-roster';

export function applyRosterImport({ perm, cw, cfg }, doc) {
  if (!doc || doc.format !== ROSTER_FORMAT || doc.version !== 1) {
    throw new Error(`Not a ${ROSTER_FORMAT} v1 file.`);
  }
  const stats = { workers: 0, cfg: 0, unknown: [], rejected: [] };
  const nextCfg = { ...(cfg || {}) };
  for (const f of RATE_CFG_FIELDS) {
    if (doc.cfg && f in doc.cfg) {
      if (isRate(doc.cfg[f])) { nextCfg[f] = doc.cfg[f]; stats.cfg++; } else stats.rejected.push(`cfg.${f}`);
    }
  }
  const byId = new Map((Array.isArray(doc.workers) ? doc.workers : []).map((w) => [w && w.id, w]));
  const apply = (list) => (Array.isArray(list) ? list : []).map((w) => {
    const row = byId.get(w.id);
    if (!row) return w;
    byId.delete(w.id);
    const next = { ...w };
    let touched = false;
    for (const f of RATE_WORKER_FIELDS) {
      if (f in row) {
        if (isRate(row[f])) { next[f] = row[f]; touched = true; } else stats.rejected.push(`${w.id}.${f}`);
      }
    }
    if (touched) stats.workers++;
    return next;
  });
  const nextPerm = apply(perm);
  const nextCW = apply(cw);
  stats.unknown = [...byId.keys()].filter(Boolean);
  return { perm: nextPerm, cw: nextCW, cfg: nextCfg, stats };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}
