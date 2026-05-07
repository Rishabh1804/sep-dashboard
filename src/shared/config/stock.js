// Default chemical stock catalog. `maxQty` enforces over-limit warnings
// (regulatory ceilings on hazardous inventory).

export const DEF_STOCK = [
  { id: 'zinc_anodes',      name: 'Zinc Anodes',     unit: 'kg', qty: 0, threshold: 50, category: 'chemical' },
  { id: 'growel_1728',      name: 'Growel 1728',     unit: 'L',  qty: 0, threshold: 10, category: 'chemical' },
  { id: 'sodium_cyanide',   name: 'Sodium Cyanide',  unit: 'kg', qty: 0, threshold: 20, maxQty: 100, category: 'chemical' },
  { id: 'sodium_hydroxide', name: 'Sodium Hydroxide', unit: 'kg', qty: 0, threshold: 30, category: 'chemical' },
  { id: 'brightener',       name: 'Brightener',      unit: 'L',  qty: 0, threshold: 5,  category: 'chemical' },
  { id: 'hcl',              name: 'HCl',             unit: 'L',  qty: 0, threshold: 20, category: 'chemical' },
];
