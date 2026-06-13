import { makeStreamFormatters, fmtTime, fmtAge } from '../../src/dashboard/stream-format.js';

describe('makeStreamFormatters()', () => {
  const fmts = makeStreamFormatters((id) => ({ c1: 'SSS Mehta' }[id] || id));

  test('production row: machine · qty · worker, with rounds suffix', () => {
    expect(fmts.production_entries.fmt({ machine_id: 'vat_a1', qty_pcs: 150, worker_id: 'w1', rounds: 6, round_size: 25 }))
      .toBe('vat_a1 · 150 NOS (6×25) · w1');
  });
  test('production row: barrel kg path', () => {
    expect(fmts.production_entries.fmt({ machine_id: 'barrel', qty_kg: 54, worker_id: 'w2' }))
      .toBe('barrel · 54 kg · w2');
  });
  test('job row resolves customer name + status', () => {
    expect(fmts.jobs.fmt({ customer_id: 'c1', challan_no: '506', received_kg: 293, current_status: 'in-flight' }))
      .toBe('Job · SSS Mehta · Ch 506 · 293 kg · in-flight');
  });
  test('note row prefixes urgent with a siren', () => {
    expect(fmts.notes.fmt({ kind: 'power_cut', summary: 'cut 4:00', priority: 'urgent' }))
      .toContain('🚨');
  });
  test('shift row reads worker id out of the subcollection path', () => {
    expect(fmts.shifts.fmt({ __path: 'workers/u-champai/shifts/s1', direction: 'in', slot: 'morning_ot' }))
      .toBe('u-champai → in · morning_ot');
  });
  test('depletion row reads stock id + level_after', () => {
    expect(fmts.depletions.fmt({ __path: 'stock_items/zinc/depletions/d1', qty_depleted: 5, level_after: 0 }))
      .toBe('zinc −5 (left: 0)');
  });
  test('default resolver leaves unknown customer id as-is', () => {
    const bare = makeStreamFormatters();
    expect(bare.jobs.fmt({ customer_id: 'cX', received_pcs: 10, current_status: 'ready' }))
      .toContain('cX');
  });
});

describe('fmtTime / fmtAge', () => {
  test('falsy ms → em dash', () => { expect(fmtTime(0)).toBe('—'); });
  test('age < 48h reads hours', () => { expect(fmtAge(6 * 3600000)).toBe('6h'); });
  test('age >= 48h reads days', () => { expect(fmtAge(50 * 3600000)).toBe('2d'); });
});
