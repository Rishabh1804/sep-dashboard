// Production area registry. `dep:true` areas (pickling) are auto-managed
// by autoPickling based on the dependent VAT/Barrel area capacity levels.

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
    roster: ['sunil_mahato', 'birsa', 'tuklu'],
  },
  {
    id: 'pickle_vat', name: 'Pickling (VAT)', group: 'vat',
    dep: true, depOn: ['vat_a1', 'vat_a2'],
    caps: [], roster: ['lk_das', 'lal', 'suklal'],
  },
  {
    id: 'pickle_barrel', name: 'Pickling (Barrel)', group: 'barrel',
    dep: true, depOn: ['barrel'],
    caps: [], roster: ['rupa_bera', 'bp_sharma'],
  },
];
