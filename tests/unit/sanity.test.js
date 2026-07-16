// Sanity / 2σ net — Welford stats + plausibility verdict + record check.

import {
  emptyStats, pushStat, stdev, zScore, MIN_HISTORY,
  fieldVerdict, checkRecord, statFields, deriveSanityState, SANITY,
} from '../../src/handler/sanity.js';

describe('Welford online stats', () => {
  test('mean + sample stddev match a hand-computed batch', () => {
    let s = emptyStats();
    for (const x of [2, 4, 4, 4, 5, 5, 7, 9]) s = pushStat(s, x);
    expect(s.n).toBe(8);
    expect(s.mean).toBeCloseTo(5, 10);
    // sample stddev of that classic set is sqrt(32/7) ≈ 2.138
    expect(stdev(s)).toBeCloseTo(Math.sqrt(32 / 7), 6);
  });

  test('stddev is 0 with fewer than 2 samples', () => {
    expect(stdev(emptyStats())).toBe(0);
    expect(stdev(pushStat(emptyStats(), 10))).toBe(0);
  });

  test('non-finite samples are ignored, not folded as 0', () => {
    let s = pushStat(emptyStats(), 10);
    s = pushStat(s, NaN);
    s = pushStat(s, 'not a number');
    expect(s.n).toBe(1);
    expect(s.mean).toBe(10);
  });

  test('pushStat is pure — the input stats object is not mutated', () => {
    const s0 = pushStat(emptyStats(), 5);
    const snapshot = { ...s0 };
    pushStat(s0, 500);
    expect(s0).toEqual(snapshot);
  });

  test('zScore is 0 until spread is known, then signed distance in σ', () => {
    let s = emptyStats();
    expect(zScore(s, 100)).toBe(0);
    for (const x of [10, 12, 8, 11, 9, 10, 12, 8]) s = pushStat(s, x);
    expect(zScore(s, s.mean)).toBeCloseTo(0, 6);
    expect(zScore(s, s.mean + stdev(s))).toBeCloseTo(1, 6);
  });
});

describe('fieldVerdict', () => {
  const cfg = { hardMin: 0, hardMax: 100000, softMax: 40000, z: 3 };

  test('a normal value is ok', () => {
    expect(fieldVerdict(450, cfg).level).toBe('ok');
  });
  test('absent / non-numeric values are ok (presence is the Zod gate\'s job)', () => {
    expect(fieldVerdict('', cfg).level).toBe('ok');
    expect(fieldVerdict(null, cfg).level).toBe('ok');
    expect(fieldVerdict('abc', cfg).level).toBe('ok');
  });
  test('at/above the hard ceiling is block', () => {
    expect(fieldVerdict(100000, cfg).level).toBe('block');
    expect(fieldVerdict(250000, cfg).level).toBe('block');
  });
  test('above the soft ceiling (but below hard) is confirm — works with no history', () => {
    const v = fieldVerdict(45000, cfg);
    expect(v.level).toBe('confirm');
    expect(v.reason).toMatch(/40000/);
  });
  test('below a declared soft floor is confirm', () => {
    const v = fieldVerdict(1, { hardMin: 0, hardMax: 50, softMin: 2, softMax: 30, z: 3 });
    expect(v.level).toBe('confirm');
  });

  test('rolling 2σ net fires only once history matures', () => {
    // Build a tight distribution around 100.
    let s = emptyStats();
    for (let i = 0; i < MIN_HISTORY; i++) s = pushStat(s, 100 + (i % 2 === 0 ? 1 : -1));
    const wide = { hardMin: 0, hardMax: 1e9, z: 3 }; // no soft bounds → only the σ net can fire
    // A value far from the mean now prompts…
    expect(fieldVerdict(100 + 50 * stdev(s), wide, s).level).toBe('confirm');
    // …but with thin history (below MIN_HISTORY) it would not.
    let thin = emptyStats();
    for (let i = 0; i < MIN_HISTORY - 1; i++) thin = pushStat(thin, 100);
    expect(fieldVerdict(9999, wide, thin).level).toBe('ok');
  });
});

describe('checkRecord', () => {
  test('a normal production entry raises nothing', () => {
    expect(checkRecord('production', { quantity: 450, rounds: 25, round_size: 18 })).toEqual([]);
  });
  test('an order-of-magnitude fat-finger is flagged', () => {
    const flags = checkRecord('production', { quantity: 450000 });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ key: 'quantity', level: 'block', value: 450000 });
  });
  test('block sorts before confirm (worst-first)', () => {
    const flags = checkRecord('stock_refill', { quantity: 500000, cost: 2000000 });
    expect(flags.map((f) => f.level)).toEqual(['block', 'confirm']);
  });
  test('unconfigured form types raise nothing', () => {
    expect(checkRecord('note', { note_text: 'x' })).toEqual([]);
    expect(checkRecord('check_in', { direction: 'in' })).toEqual([]);
  });
  test('a fresh DFT reading of 8µm is normal; 45µm prompts', () => {
    expect(checkRecord('dft', { dft_micron: 8 })).toEqual([]);
    expect(checkRecord('dft', { dft_micron: 45 })[0].level).toBe('confirm');
  });

  test('level_after: 0 (NIL stock-take) is NOT blocked — it is a valid reading', () => {
    // Regression: hardMin:0 once made fieldVerdict block v <= 0, so the NIL
    // reorder signal could never be submitted.
    expect(checkRecord('stock_deplete', { quantity: 5, level_after: 0 })).toEqual([]);
  });

  test('cost: 0 (unpriced receipt) is NOT blocked', () => {
    expect(checkRecord('stock_refill', { quantity: 100, cost: 0 })).toEqual([]);
  });
});

describe('deriveSanityState — production rounds × round_size', () => {
  test('derives the total under quantity when no explicit total is given', () => {
    const s = deriveSanityState('production', { rounds: 100, round_size: 999 });
    expect(s.quantity).toBe(99900);
    // …and that derived total then trips the sanity net (softMax 40000).
    expect(checkRecord('production', s)[0]).toMatchObject({ key: 'quantity', level: 'confirm' });
  });
  test('an explicit total is left untouched', () => {
    const s = deriveSanityState('production', { quantity: 450, rounds: 25, round_size: 18 });
    expect(s.quantity).toBe(450);
  });
  test('non-production forms pass through unchanged', () => {
    const st = { quantity: 5, level_after: 0 };
    expect(deriveSanityState('stock_deplete', st)).toBe(st);
  });
  test('partial rounds (no round_size) does not fabricate a total', () => {
    expect(deriveSanityState('production', { rounds: 100 }).quantity).toBeUndefined();
  });
});

describe('statFields mirrors the SANITY config', () => {
  test('every configured form exposes its numeric keys', () => {
    for (const type of Object.keys(SANITY)) {
      expect(statFields(type)).toEqual(Object.keys(SANITY[type]));
    }
  });
  test('an unconfigured form has no stat fields', () => {
    expect(statFields('note')).toEqual([]);
  });
});
