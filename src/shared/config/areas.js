// Production area registry. `dep:true` areas (pickling) are auto-managed
// by autoPickling based on the dependent VAT/Barrel area capacity levels.
//
// `roster` is the DEFAULT deployment for an area, not a constraint — the
// attendance record shows heavy flexing day to day (Sarat appears on both A1
// and A2 lists in the same shift). Two corrections against the codex:
//   · The permanent contract tier is "Job Work only, can flex VAT/Barrel
//     areas, **NOT Pickling**" (soma-internal
//     `frameworks/roles-responsibilities-v1.1.md`; repeated on each man's row
//     in `staff-aliases.md`). All three were seeded into pickling rosters
//     their tier is defined to exclude — `lk_das` + `lal` in pickle_vat,
//     `bp_sharma` in pickle_barrel. Removed.
//     ⚠ The replacements are the ONE judgement call in this file. `roster`
//     is functional (production.js auto-assigns every PRESENT member), so
//     emptying the pickling areas would stop them ever being crewed. They are
//     refilled from the four men `staff-aliases.md` labels "Daily anchor
//     (Pickling primary)" — Sambhu, Sripati, Budheswer, Birsa, which is also
//     exactly the framework's "Four workers — primarily Pickling" — split
//     VAT-side / barrel-side as `attendance/2026-W33.md` shows them working,
//     and Suklal held as Pickling Lead. Sizes are unchanged (3 and 2).
//     Confirm the split with Vulcanus/BM; the REMOVALS need no confirmation.
//   · `rupa_bera` removed from pickle_barrel — she is VAT A2 Lead and appears
//     on no pickling slot in the W33 record.
//   · `tuklu` removed from barrel — off active pool, AWOL confirmed 18 May
//     2026 (`staff-aliases.md`). He stays in DEF_CW as `inactive`.

export const DEF_AREAS = [
  {
    id: 'vat_a1', name: 'VAT A1', group: 'vat', dep: false, depOn: [],
    caps: [
      { l: 0,   lb: 'Off',  r: 0 },
      { l: 33,  lb: '33%',  r: 3 },
      { l: 66,  lb: '66%',  r: 4 },
      { l: 100, lb: '100%', r: 5 },
    ],
    roster: ['sharat_mahato', 'bp_sharma', 'lk_das', 'lal', 'suklal'],
  },
  {
    id: 'vat_a2', name: 'VAT A2', group: 'vat', dep: false, depOn: [],
    caps: [
      { l: 0,   lb: 'Off',  r: 0 },
      { l: 25,  lb: '25%',  r: 2 },
      { l: 50,  lb: '50%',  r: 3 },
      { l: 75,  lb: '75%',  r: 4 },
      { l: 100, lb: '100%', r: 4 },
    ],
    roster: ['sharat_mahato', 'sai', 'shambhu', 'mantu'],
  },
  {
    id: 'barrel', name: 'Barrel', group: 'barrel', dep: false, depOn: [],
    caps: [
      { l: 0,   lb: 'Off',  r: 0 },
      { l: 25,  lb: '25%',  r: 2 },
      { l: 50,  lb: '50%',  r: 2 },
      { l: 75,  lb: '75%',  r: 3 },
      { l: 100, lb: '100%', r: 3 },
    ],
    roster: ['sunil_mahato', 'birsa'],
  },
  {
    id: 'pickle_vat', name: 'Pickling (VAT)', group: 'vat',
    dep: true, depOn: ['vat_a1', 'vat_a2'],
    caps: [], roster: ['suklal', 'sripati', 'budheswar'],
  },
  {
    id: 'pickle_barrel', name: 'Pickling (Barrel)', group: 'barrel',
    dep: true, depOn: ['barrel'],
    caps: [], roster: ['shambhu', 'birsa'],
  },
];
