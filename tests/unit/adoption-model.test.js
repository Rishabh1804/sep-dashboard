import {
  ADOPTION_FORMS, WEEK1_TARGETS, STEADY_TARGET,
  isoWeekStart, isoWeekKey, addWeeks, weekEnd, dayIndex,
  isPersonAuthored, countByFormDay, sum, rate, statusFor, targetForRolloutDay,
  summarizeWeek, readPaperStore, setPaperCount, paperForWeek,
} from '../../src/dashboard/adoption-model.js';

const at = (iso) => new Date(iso).getTime();

describe('week arithmetic (ISO, Monday-start)', () => {
  test('any day of the week resolves to its Monday at midnight', () => {
    for (const iso of ['2026-08-24T09:00', '2026-08-27T23:59', '2026-08-30T12:00']) {
      const ws = isoWeekStart(new Date(iso));
      expect(ws.getDay()).toBe(1);
      expect(ws.getDate()).toBe(24);
      expect(ws.getHours()).toBe(0);
    }
  });

  test('Sunday belongs to the week that started six days earlier, not the next one', () => {
    // getDay()===0 for Sunday: the classic off-by-one this guards.
    expect(isoWeekStart(new Date('2026-08-30T12:00')).getDate()).toBe(24);
  });

  test('isoWeekKey uses the ISO year, taken from the week Thursday', () => {
    expect(isoWeekKey(isoWeekStart(new Date('2026-08-24T00:00')))).toBe('2026-W35');
    // 1 Jan 2027 is a Friday; its week starts 28 Dec 2026 but is ISO 2026-W53.
    const nyWeek = isoWeekStart(new Date('2027-01-01T10:00'));
    expect(nyWeek.getFullYear()).toBe(2026);
    expect(isoWeekKey(nyWeek)).toMatch(/^2026-W5[23]$/);
  });

  test('addWeeks / weekEnd span exactly seven days', () => {
    const ws = isoWeekStart(new Date('2026-08-24T00:00'));
    expect(weekEnd(ws).getTime()).toBe(addWeeks(ws, 1).getTime());
    expect(Math.round((weekEnd(ws) - ws) / 86400000)).toBe(7);
  });
});

describe('dayIndex', () => {
  const ws = isoWeekStart(new Date('2026-08-24T00:00'));

  test('maps each weekday to 0..6', () => {
    expect(dayIndex(at('2026-08-24T00:00'), ws)).toBe(0);
    expect(dayIndex(at('2026-08-26T15:30'), ws)).toBe(2);
    expect(dayIndex(at('2026-08-30T23:59'), ws)).toBe(6);
  });

  test('rejects timestamps outside the week, and non-timestamps', () => {
    expect(dayIndex(at('2026-08-23T23:59'), ws)).toBe(-1);
    expect(dayIndex(at('2026-08-31T00:00'), ws)).toBe(-1);
    expect(dayIndex(NaN, ws)).toBe(-1);
    expect(dayIndex(undefined, ws)).toBe(-1);
  });
});

describe('authorship — only a person counts toward adoption', () => {
  test('rejects the importer and the aggregator CFs', () => {
    expect(isPersonAuthored({ author_user_id: 'champai' })).toBe(true);
    expect(isPersonAuthored({ author_user_id: 'system:import' })).toBe(false);
    expect(isPersonAuthored({ author_user_id: 'system' })).toBe(false);
    expect(isPersonAuthored({ author_user_id: '' })).toBe(false);
    expect(isPersonAuthored({})).toBe(false);
    expect(isPersonAuthored(null)).toBe(false);
  });
});

describe('countByFormDay', () => {
  const ws = isoWeekStart(new Date('2026-08-24T00:00'));
  const tsOf = (d) => d.ts;
  const docs = {
    production: [
      { author_user_id: 'champai', ts: at('2026-08-24T08:00') },
      { author_user_id: 'champai', ts: at('2026-08-24T17:00') },
      { author_user_id: 'champai', ts: at('2026-08-26T10:00') },
      { author_user_id: 'system:import', ts: at('2026-08-24T10:00') },  // excluded
      { author_user_id: 'champai', ts: at('2026-09-02T10:00') },        // next week
    ],
    check_in: [{ author_user_id: 'shyam', ts: at('2026-08-30T06:10') }],
  };

  test('buckets person-authored docs into weekdays', () => {
    const c = countByFormDay(docs, ws, tsOf);
    expect(c.production).toEqual([2, 0, 1, 0, 0, 0, 0]);
    expect(c.check_in).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });

  test('returns a zero row for every form, including untouched ones', () => {
    const c = countByFormDay(docs, ws, tsOf);
    expect(Object.keys(c).sort()).toEqual(ADOPTION_FORMS.map((f) => f.id).sort());
    expect(c.dft).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  test('sum totals a row', () => {
    expect(sum([2, 0, 1, 0, 0, 0, 0])).toBe(3);
    expect(sum(['', 4, undefined, 1])).toBe(5);
    expect(sum(undefined)).toBe(0);
  });
});

describe('rate — a missing denominator is not a zero and not a hundred', () => {
  test('null whenever there is no paper count', () => {
    expect(rate(5, 0)).toBeNull();
    expect(rate(5, '')).toBeNull();
    expect(rate(0, undefined)).toBeNull();
    expect(rate(5, -3)).toBeNull();
  });

  test('divides when there is one', () => {
    expect(rate(9, 10)).toBeCloseTo(0.9);
    expect(rate(0, 10)).toBe(0);
  });

  test('does NOT clamp above 1 — more digital than paper is a finding', () => {
    expect(rate(12, 10)).toBeCloseTo(1.2);
    expect(statusFor(1.2)).toBe('over');
  });
});

describe('statusFor', () => {
  test('bands against the target', () => {
    expect(statusFor(null)).toBe('unmeasured');
    expect(statusFor(0.96)).toBe('ok');
    expect(statusFor(0.95)).toBe('ok');
    expect(statusFor(0.85)).toBe('near');
    expect(statusFor(0.5)).toBe('below');
    expect(statusFor(1.0)).toBe('ok');
  });

  test('honours a lower ramp target', () => {
    expect(statusFor(0.62, 0.60)).toBe('ok');
    expect(statusFor(0.62)).toBe('below');
  });
});

describe('targetForRolloutDay — the ADOPTION_PLAN Week 1 ramp', () => {
  test('steps 60 → 80 → 95', () => {
    expect(targetForRolloutDay(1)).toBeCloseTo(0.60);
    expect(targetForRolloutDay(4)).toBeCloseTo(0.60);
    expect(targetForRolloutDay(5)).toBeCloseTo(0.80);
    expect(targetForRolloutDay(7)).toBeCloseTo(0.95);
    expect(targetForRolloutDay(30)).toBeCloseTo(0.95);
    expect(WEEK1_TARGETS.at(-1).target).toBe(STEADY_TARGET);
  });
});

describe('summarizeWeek', () => {
  const counts = {
    production: [10, 10, 0, 0, 0, 0, 0],
    check_in: [4, 0, 0, 0, 0, 0, 0],
  };
  const paper = { production: [10, 12, '', '', '', '', ''] };

  test('totals per form and overall, on the same subset', () => {
    const s = summarizeWeek(counts, paper);
    const prod = s.rows.find((r) => r.id === 'production');
    expect(prod.digitalTotal).toBe(20);
    expect(prod.expectedTotal).toBe(22);
    expect(prod.rate).toBeCloseTo(20 / 22);
    // check_in has digital entries but no paper count → unmeasured, not 0%.
    const ci = s.rows.find((r) => r.id === 'check_in');
    expect(ci.rate).toBeNull();
    expect(ci.status).toBe('unmeasured');
  });

  test('states how much of the picture is actually measured', () => {
    const s = summarizeWeek(counts, paper);
    expect(s.formsMeasured).toBe(1);
    expect(s.formsTotal).toBe(ADOPTION_FORMS.length);
  });

  test('overall rate divides totals over ALL forms, numerator and denominator alike', () => {
    const s = summarizeWeek(counts, paper);
    expect(s.digitalTotal).toBe(24);   // includes check_in's 4
    expect(s.expectedTotal).toBe(22);
    expect(s.status).toBe('over');     // and that is the reconciliation flag
  });

  test('an empty week is unmeasured, never 0% and never 100%', () => {
    const s = summarizeWeek({}, {});
    expect(s.rate).toBeNull();
    expect(s.status).toBe('unmeasured');
  });
});

describe('paper store', () => {
  test('readPaperStore survives junk, truncation and hand-edits', () => {
    expect(readPaperStore('not json')).toEqual({});
    expect(readPaperStore(null)).toEqual({});
    expect(readPaperStore('[]')).toEqual({});
    expect(readPaperStore(JSON.stringify({ '2026-W35': { production: 'oops' } })))
      .toEqual({ '2026-W35': {} });
    const short = readPaperStore(JSON.stringify({ '2026-W35': { production: [3, 4] } }));
    expect(short['2026-W35'].production).toEqual([3, 4, '', '', '', '', '']);
  });

  test('drops unknown form ids and negative counts', () => {
    const s = readPaperStore(JSON.stringify({
      '2026-W35': { production: [1, -2, 'x', 4, 5, 6, 7], bogus_form: [1, 1, 1, 1, 1, 1, 1] },
    }));
    expect(s['2026-W35'].bogus_form).toBeUndefined();
    expect(s['2026-W35'].production).toEqual([1, '', '', 4, 5, 6, 7]);
  });

  test('setPaperCount validates form, day and value', () => {
    let s = {};
    s = setPaperCount(s, '2026-W35', 'production', 0, '12');
    expect(paperForWeek(s, '2026-W35').production[0]).toBe(12);

    // blanking is legal — it means "not counted", not zero
    s = setPaperCount(s, '2026-W35', 'production', 0, '  ');
    expect(paperForWeek(s, '2026-W35').production[0]).toBe('');

    // rejected, store unchanged
    expect(setPaperCount(s, '2026-W35', 'nope', 0, '1')).toBe(s);
    expect(setPaperCount(s, '2026-W35', 'production', 7, '1')).toBe(s);
    expect(setPaperCount(s, '2026-W35', 'production', -1, '1')).toBe(s);
    expect(setPaperCount(s, '2026-W35', 'production', 1, '-4')).toBe(s);
    expect(setPaperCount(s, '2026-W35', 'production', 1, 'abc')).toBe(s);
  });

  test('weeks are independent', () => {
    let s = setPaperCount({}, '2026-W35', 'dft', 2, '5');
    s = setPaperCount(s, '2026-W36', 'dft', 2, '9');
    expect(paperForWeek(s, '2026-W35').dft[2]).toBe(5);
    expect(paperForWeek(s, '2026-W36').dft[2]).toBe(9);
    expect(paperForWeek(s, '2026-W99')).toEqual({});
  });
});

describe('form → collection wiring matches the handler transport', () => {
  test('every handler form has an adoption row', () => {
    expect(ADOPTION_FORMS.map((f) => f.id).sort()).toEqual([
      'check_in', 'dft', 'dispatch', 'job_receipt', 'machine_state',
      'note', 'production', 'stock_deplete', 'stock_refill',
    ]);
  });

  test('subcollection reads are marked as collection groups', () => {
    const g = ADOPTION_FORMS.filter((f) => f.group).map((f) => f.coll).sort();
    expect(g).toEqual(['depletions', 'receipts', 'shifts', 'state_transitions']);
  });
});
