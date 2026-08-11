// Production area registry. `dep:true` areas (pickling) are auto-managed
// by autoPickling based on the dependent VAT/Barrel area capacity levels.
//
// CANONICAL SOURCE: soma-internal `operations/work-areas.md` (ratified 11 Aug
// 2026). Two axes are defined there and both are carried here:
//   `id` / `name`  = the STATION (a crew-assignment slot).
//   `area`         = the physical place on the floor (Area 1-4).
// Area 4 holds two stations (pickle_vat + pickle_barrel) because pickling is
// one room but two crews, split by what each feeds. That is the floor, not a
// modelling error — do not collapse them.
//
// `establishment` = the full-house crew for the station, and it is what the
// EXTRA ruling is computed against:
//     EXTRA hours = (establishment - present) x block hours, when the station
//     ran at 100%.  (BM, 11 Aug 2026.)
// Confirmed against the register: Fri 7 / Sat 8 Aug 2026 are the only two days
// of W32 carrying zero EXTRA, and they are exactly the two days every station
// sits at these numbers.
//
// `caps[].r` is the dashboard's own per-capacity-level headcount ladder and
// `recalcExtra` already implements the deficit formula against it. The TOP rung
// must therefore equal `establishment` — see the vat_a1 note below. Intermediate
// rungs have no register counterpart and are unverified.
//
// `roster` is who has actually manned the station, rebuilt 11 Aug from the W32
// register (the primary production source since 8 Aug) — NOT from the stale
// 8-May roster file. It drives worker-to-area assignment in tabs/production.js.

export const DEF_AREAS = [
  {
    id: 'vat_a1', name: 'VAT A1', group: 'vat', dep: false, depOn: [],
    area: 'area_1', establishment: 4,
    caps: [
      { l: 0,   lb: 'Off',  r: 0 },
      { l: 33,  lb: '33%',  r: 3 },
      { l: 66,  lb: '66%',  r: 4 },
      // 11 Aug: was r:5, which exceeded the register's establishment of 4 and
      // would credit one phantom body-block (8 hr / Rs 380) of EXTRA on every
      // full-capacity A1 day. Now plateaus at the top exactly as vat_a2 (75/100
      // both 4) and barrel (75/100 both 3) already do.
      { l: 100, lb: '100%', r: 4 },
    ],
    roster: ['lk_das', 'bp_sharma', 'vijay', 'birsa', 'sharat_mahato',
             'rupa_bera', 'sai', 'rakesh', 'lal'],
  },
  {
    id: 'vat_a2', name: 'VAT A2', group: 'vat', dep: false, depOn: [],
    area: 'area_2', establishment: 4,
    caps: [
      { l: 0,   lb: 'Off',  r: 0 },
      { l: 25,  lb: '25%',  r: 2 },
      { l: 50,  lb: '50%',  r: 3 },
      { l: 75,  lb: '75%',  r: 4 },
      { l: 100, lb: '100%', r: 4 },
    ],
    roster: ['sharat_mahato', 'rupa_bera', 'sai', 'rocky', 'lk_das',
             'bp_sharma', 'vijay', 'shambhu', 'lal'],
  },
  {
    id: 'barrel', name: 'Barrel', group: 'barrel', dep: false, depOn: [],
    area: 'area_3', establishment: 3,
    caps: [
      { l: 0,   lb: 'Off',  r: 0 },
      { l: 25,  lb: '25%',  r: 2 },
      { l: 50,  lb: '50%',  r: 2 },
      { l: 75,  lb: '75%',  r: 3 },
      { l: 100, lb: '100%', r: 3 },
    ],
    roster: ['shyam_bera', 'sunil_mahato', 'suklal'],
  },
  {
    id: 'pickle_vat', name: 'Pickling (VAT)', group: 'vat',
    dep: true, depOn: ['vat_a1', 'vat_a2'],
    area: 'area_4', establishment: 3,
    caps: [], roster: ['naren', 'sripati', 'rakesh', 'birsa', 'vijay'],
  },
  {
    id: 'pickle_barrel', name: 'Pickling (Barrel)', group: 'barrel',
    dep: true, depOn: ['barrel'],
    area: 'area_4', establishment: 2,
    caps: [], roster: ['shambhu', 'budheswar'],
  },
];

// Physical floor registry — the `area` axis. Machine counts per the Session-11
// domain lock; the station mapping per work-areas.md.
// Area 1 = vat_a1 CONFIRMED by BM 11 Aug 2026: "A1 is the room with 4 tanks,
// only 3 are operational" — which independently corroborates the Session-11
// counts below (4 machines, 3 functional), written in April from a different
// conversation. Area 2 = vat_a2 follows by elimination on a closed set of two
// VAT areas. soma-internal T-EL closed.
// NOTE (soma-internal T-EN): vat_a1's capacity reference is a THREE-tank
// number — measured while machine 2 was down. It is not the line's ceiling.
export const DEF_FLOOR_AREAS = [
  { id: 'area_1', name: 'Area 1', process: 'VAT, cyanide zinc', machines: 4, functional: 3, stations: ['vat_a1'] },
  { id: 'area_2', name: 'Area 2', process: 'VAT (1 tank, 2 lines)', machines: 2, functional: 2, stations: ['vat_a2'] },
  { id: 'area_3', name: 'Area 3', process: 'Barrel, acid zinc', machines: 8, functional: 4, stations: ['barrel'] },
  { id: 'area_4', name: 'Area 4', process: 'Pickling (HCl)', machines: 6, functional: null, stations: ['pickle_vat', 'pickle_barrel'] },
];

// Floor establishment: 4 + 4 + 3 + 2 + 3 = 16 hands, plus office and gate = 18
// all-in. Derived rather than restated so it cannot drift from the registry.
export const FLOOR_ESTABLISHMENT = DEF_AREAS.reduce((n, a) => n + a.establishment, 0);
