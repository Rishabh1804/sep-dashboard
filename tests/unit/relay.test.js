// Relay reader (Session 20). Every name and figure here is synthetic —
// the real relay lives in soma-internal and never enters this public repo.
import { splitExport, detectDateOrder, messageKey } from '../../src/shared/relay/export.js';
import {
  parseMessages, classify, checkArithmetic, readStockLine, readAreaHeader, lineQuantity, SEVERITY,
} from '../../src/shared/relay/parse.js';

function msg(body, over = {}) {
  return { date: '2026-09-16', time: '17:00', author: 'Floor', body, system: false, media: false, line: 1, ...over };
}

function parse(body, over) {
  return parseMessages([msg(body, over)]);
}

const of = (r, type) => r.records.filter((x) => x.type === type);
const actions = (r) => r.flags.filter((f) => f.severity === SEVERITY.ACTION);

describe('splitExport', () => {
  test('reads the Android shape, day-first, with multi-line bodies', () => {
    const { order, messages } = splitExport([
      '16/09/2026, 2:18 pm - Messages and calls are end-to-end encrypted.',
      '17/09/2026, 5:08 pm - Floor Hand: 15/09/26/ out time',
      '-----5:00 pm----',
      '1) ANIL',
      '17/09/2026, 5:09 pm - Floor Hand: <Media omitted>',
    ].join('\n'));
    expect(order).toBe('dmy');
    expect(messages).toHaveLength(3);
    expect(messages[0].system).toBe(true);
    expect(messages[1]).toMatchObject({ date: '2026-09-17', time: '17:08', author: 'Floor Hand' });
    expect(messages[1].body.split('\n')).toHaveLength(3);
    expect(messages[2].media).toBe(true);
  });

  test('reads the bracketed shape, month-first, and strips forward and edit marks', () => {
    const { order, messages } = splitExport([
      '‎[9/16/26, 4:13:26 PM] Floor Hand: [Forwarded] 1) ANIL <This message was edited>',
      '[9/17/26, 9:05:00 AM] Owner: <image omitted>',
    ].join('\n'));
    expect(order).toBe('mdy');
    expect(messages[0]).toMatchObject({ date: '2026-09-16', time: '16:13', body: '1) ANIL' });
    expect(messages[1].media).toBe(true);
  });

  test('a field over 12 settles the date order whatever the shape', () => {
    expect(detectDateOrder(['[16/9/26, 4:13 PM] A: x'])).toBe('dmy');
    expect(detectDateOrder(['9/16/2026, 4:13 pm - A: x'])).toBe('mdy');
  });

  test('the same message keys identically in both export shapes', () => {
    const a = splitExport('17/09/2026, 5:08 pm - Floor Hand: hello\nthere').messages[0];
    const b = splitExport('[9/17/26, 5:08:54 PM] Floor Hand: hello\nthere').messages[0];
    expect(messageKey(a)).toBe(messageKey(b));
  });
});

describe('checkArithmetic', () => {
  test('flags a sum that does not foot and passes one that does', () => {
    expect(checkArithmetic('Q9 30-4=36 KG')).toHaveLength(1);
    expect(checkArithmetic('Q9 30-4=26 KG')).toHaveLength(0);
    expect(checkArithmetic('add 60+10=70 LTR')).toHaveLength(0);
  });
  test('a chain is size notation, not a sum', () => {
    expect(checkArithmetic('CLAMP 140×94=35×6=400 NOS')).toHaveLength(0);
  });
  test('two large factors are a part size, not a product', () => {
    expect(checkArithmetic('clamp 90×94=460 (30×6)')).toHaveLength(0);
  });
  test('a number after a one-letter word is a code ("V A 2-40=50")', () => {
    expect(checkArithmetic('use V A 2-40=50 KG')).toHaveLength(0);
  });
  test('a small product that does not foot is still flagged', () => {
    expect(checkArithmetic('25×6=350 NOS')).toHaveLength(1);
  });
});

describe('readStockLine', () => {
  test('foots start − use = available', () => {
    expect(readStockLine('7) BRIGHTENER 80 LTR 6 day 5×6=30use available 50LTR'))
      .toMatchObject({ item: 'BRIGHTENER', start: 80, use: 30, available: 50, unit: 'ltr', foots: true });
  });
  test('an add total opens the line, and a line that does not foot says so', () => {
    expect(readStockLine('14) ACID X add 60+10=70 LTR use 6 day 30 LTR available 70 LTR'))
      .toMatchObject({ item: 'ACID X', start: 70, use: 30, available: 70, foots: false });
  });
  test('a number in the item name is not its level ("65 M 21 LTR")', () => {
    expect(readStockLine('8) 65 M 21 LTR use 6 day 3×6=18 LTR use available 3 LTR'))
      .toMatchObject({ item: '65 M', start: 21, use: 18, available: 3, foots: true });
    expect(readStockLine('982 L- 8 liter stock')).toMatchObject({ item: '982 L', start: 8, unit: 'ltr' });
  });
  test('a dated use reads the quantity, not the date', () => {
    expect(readStockLine('15) ACID Y add 660 LTR use 21/09/26/ 300 LTR available 360 LTR'))
      .toMatchObject({ start: 660, use: 300, available: 360, foots: true });
  });
  test('NIL is a level', () => {
    expect(readStockLine('13) SPRAY NIL 00')).toMatchObject({ item: 'SPRAY', nil: true });
  });
});

describe('readAreaHeader', () => {
  test.each([
    ['----VAT A 1----', ['vat-a1']],
    ['VAT A 2', ['vat-a2']],
    ['---berral & pickling---', ['barrel', 'barrel-pickling']],
    ['-----pickling VAT A 1---', ['pickling-a1']],
    ['--pickling A 1 A 2-----', ['pickling-a1', 'pickling-a2']],
    ['A1 & pickling', ['vat-a1', 'pickling']],
    ['office & gate keeper', ['office', 'gate']],
  ])('%s', (line, areas) => {
    expect(readAreaHeader(line).areas).toEqual(areas);
  });
  test('absence headers carry their class', () => {
    expect(readAreaHeader('--monthly- absent---')).toMatchObject({ areas: [], absent: 'monthly' });
    expect(readAreaHeader('---weekly--absent---').absent).toBe('weekly');
  });
  test('a crew line is not a header', () => {
    expect(readAreaHeader('1) ANIL')).toBeNull();
    expect(readAreaHeader('LINER 1000 NOS')).toBeNull();
  });
});

test('lineQuantity takes the last count on the line', () => {
  expect(lineQuantity('3301-600 nos')).toEqual({ qty: 600, unit: 'nos' });
  expect(lineQuantity('90CD 3bag')).toEqual({ qty: 3, unit: 'bag' });
  expect(lineQuantity('Mehta liner')).toBeNull();
});

describe('attendance', () => {
  const sheet = [
    '16/09/26/ in time',
    '----6:00 AM---',
    '1) ANIL',
    '2) BINA',
    'EXTRA 6 HOURS',
    '----8:30 AM---',
    '---VAT A 1----',
    '1) CHETAN',
    '2) DEV',
    '3) ESHA',
    'EXTRA 8 HOURS',
    '---berral & pickling---',
    '4) FARID',
    'PART 8257-100 KG',
    'CLAMP',
    '1360 NOS',
    '---office & gate keeper',
    '5) GITA 7:00 PM',
    '--monthly- absent---',
    '6) HARI',
    '---weekly--absent---',
    '7) INDU',
    '',
    '17/09/26/ festival holiday',
  ].join('\n');
  const r = parse(sheet);
  const marks = of(r, 'attendance');

  test('reads every crew line with its block, area and status', () => {
    expect(marks).toHaveLength(9);
    expect(marks[0]).toMatchObject({ date: '2026-09-16', direction: 'in', name: 'ANIL', block: { time: '06:00' }, areas: [], status: 'present' });
    expect(marks[2]).toMatchObject({ name: 'CHETAN', block: { time: '08:30' }, areas: ['vat-a1'] });
    expect(marks[5]).toMatchObject({ name: 'FARID', areas: ['barrel', 'barrel-pickling'] });
    expect(marks.find((m) => m.name === 'GITA')).toMatchObject({ time: '19:00', areas: ['office', 'gate'] });
    expect(marks.find((m) => m.name === 'HARI')).toMatchObject({ status: 'absent', absentClass: 'monthly' });
    expect(marks.find((m) => m.name === 'INDU')).toMatchObject({ status: 'absent', absentClass: 'weekly' });
  });

  test('EXTRA books to the crew above it, with its head count', () => {
    const ex = of(r, 'extra');
    expect(ex[0]).toMatchObject({ hours: 6, heads: 2, areas: [], block: { time: '06:00' } });
    expect(ex[1]).toMatchObject({ hours: 8, heads: 3, areas: ['vat-a1'] });
    // No area on the early crew: kept, and said to be uncheckable.
    expect(r.flags.some((f) => /no area named/.test(f.reason))).toBe(true);
  });

  test('production lines, including a name with its count on the next line', () => {
    const p = of(r, 'production');
    expect(p.map((x) => [x.qty, x.unit])).toEqual([[100, 'kg'], [1360, 'nos']]);
    expect(p[1].text).toBe('CLAMP 1360 NOS');
  });

  test('a trailing holiday line is its own record', () => {
    expect(of(r, 'holiday')).toEqual([expect.objectContaining({ date: '2026-09-17', label: 'festival holiday' })]);
  });

  test('a direction-named block ends an absence list (regression: hands read as absent)', () => {
    const r2 = parse(['29/08/26/ in time', '----weekly absent---', '1) ANIL', '----in time 2:00 pm---', '2) BINA', 'EXTRA 8 HOURS'].join('\n'), { date: '2026-08-29' });
    const m = of(r2, 'attendance');
    expect(m[0]).toMatchObject({ name: 'ANIL', status: 'absent' });
    expect(m[1]).toMatchObject({ name: 'BINA', status: 'present', block: { time: '14:00' } });
    expect(of(r2, 'extra')[0].heads).toBe(1);
  });

  test('hold night, in/out pairs and unnumbered crew lines', () => {
    const r2 = parse(['15/09/26/ out time', '---hold night-6:00am---', '1) ANIL 8:30 am 5:00 pm', '2) BINA 5: PM 6 AM', '--------', 'CHETAN 12:00 AM', 'EXTRA 12 HOURS'].join('\n'));
    const m = of(r2, 'attendance');
    expect(m[0]).toMatchObject({ direction: 'out', block: { time: '06:00', holdNight: true }, inTime: '08:30', outTime: '17:00' });
    expect(m[1]).toMatchObject({ name: 'BINA', inTime: '17:00', outTime: '06:00' });
    expect(m[2]).toMatchObject({ name: 'CHETAN', time: '00:00' });
    expect(of(r2, 'extra')[0].heads).toBe(1);
    expect(actions(r2)).toHaveLength(0);
  });

  test('all-out lines in their several spellings', () => {
    const r2 = parse(['18/09/26/ out time', '----5:00 pm---', 'All out'].join('\n'));
    expect(of(r2, 'all_out')).toHaveLength(1);
    const r3 = parse(['05/08/26/ out time', '1) ANIL 7:00 PM', 'Baki sab 5:00 pm out'].join('\n'), { date: '2026-08-05' });
    expect(of(r3, 'all_out')[0].time).toBe('17:00');
    const r4 = parse('15/4/26/ out time all 5pm', { date: '2026-04-15' });
    expect(of(r4, 'all_out')[0].time).toBe('17:00');
  });

  test('a reversed header and a day-type header both read as sheets', () => {
    const r2 = parse(['Out time 09/09/26/', '-----5:00 pm----', '1) ANIL'].join('\n'), { date: '2026-09-09' });
    expect(of(r2, 'attendance')[0]).toMatchObject({ date: '2026-09-09', direction: 'out' });
    const r3 = parse(['23/08/26/ Sunday 6:00 am 2 pm', '-----VAT A 1-----', '1) ANIL', '2) BINA', 'EXTRA 16 HOURS'].join('\n'), { date: '2026-08-24' });
    expect(of(r3, 'attendance')[0]).toMatchObject({ day: 'sunday', block: { time: '06:00' }, areas: ['vat-a1'] });
  });

  test('a stock take under the crew list is read as stock and footed', () => {
    const r2 = parse(['16/09/26/ in time', '1) ANIL', '1) ZINC 25-25=00 use barrel', '2) Q9 30-4=36 KG', '3) SPRAY 6 NOS'].join('\n'));
    expect(of(r2, 'attendance')).toHaveLength(1);
    expect(of(r2, 'stock').map((s) => s.item)).toEqual(['ZINC', 'Q9', 'SPRAY']);
    expect(actions(r2).map((f) => f.reason)).toEqual([expect.stringMatching(/^does not foot: 30-4=36/)]);
  });

  test('flags an EXTRA with nothing above it and a work date far from the send date', () => {
    const r2 = parse(['01/09/26/ in time', 'EXTRA 6 HOURS'].join('\n'));
    expect(actions(r2).map((f) => f.reason)).toEqual([
      expect.stringMatching(/^work date 2026-09-01 is 15 day/),
      'EXTRA tag with no crew or area above it',
    ]);
  });
});

describe('the other message shapes', () => {
  test('pickling log, typo-tolerant, with the time read by shop hours', () => {
    const r = parse(['CUSTOMER A', 'C CLAMP--1200 NOS', 'PICKLIBG TIME 9:30 NOS'].join('\n'));
    expect(of(r, 'pickling')[0]).toMatchObject({ customer: 'CUSTOMER A', time: '09:30', items: [expect.objectContaining({ qty: 1200 })] });
    expect(r.flags.map((f) => f.reason)).toEqual([expect.stringMatching(/no am\/pm .* read as 09:30/)]);
    const r2 = parse(['CUSTOMER B', 'Clamp --80kg', 'Pickling Time 11: am'].join('\n'));
    expect(of(r2, 'pickling')[0].time).toBe('11:00');
    expect(parse('X\nPICKĹING TIME 10:00 AM').records[0].type).toBe('pickling');
  });

  test('stock take: footing, headings and continuation lines', () => {
    const r = parse(['STOCK 22/09/26', '1) BRIGHTENER 80 LTR 6 day 5×6=30use available 50LTR', '2) ACID X add 60+10=70 LTR use 6 day 30 LTR available 70 LTR', '3) ACID Y add 660 LTR', 'use 21/09/26/ 300 LTR available 360 LTR', '4) SALT NIL 00'].join('\n'));
    const s = of(r, 'stock');
    expect(s.map((x) => [x.item, x.foots])).toEqual([['BRIGHTENER', true], ['ACID X', false], ['ACID Y', true], ['SALT', null]]);
    expect(s[0].date).toBe('2026-09-22');
    expect(actions(r).map((f) => f.reason)).toEqual(['stock does not foot: 70 − 30 = 40, relay says 70']);
  });

  test('stock levels without footing', () => {
    const r = parse(['Q9- 40Kg', '65M- Nil', 'A Salt - 60 Litre', 'Zinc- Nil'].join('\n'));
    expect(of(r, 'stock')).toHaveLength(4);
    expect(actions(r)).toHaveLength(0);
  });

  test('incoming material, production log, payment slip, loading log, power cut, chat', () => {
    expect(of(parse(['Incoming Material time 3:30pm', 'CUSTOMER C', '4201--500kg'].join('\n')), 'incoming')[0])
      .toMatchObject({ time: '15:30', party: 'CUSTOMER C', items: [expect.objectContaining({ qty: 500, unit: 'kg' })] });
    const pl = parse(['01/09/26/ berral production', '-------', 'Clamp', '800 nos', 'Part 0108-600nos'].join('\n'));
    expect(of(pl, 'production').map((x) => x.qty)).toEqual([800, 600]);
    expect(of(parse('Weekly payment 01/09/26/ to 06/09/26/\n1) ANIL 21+11=32×47.5=1520'), 'payment_slip')[0].period).toBe('weekly');
    expect(of(parse('9 am mk 120×4  10am mk120×4  11am ck 400×2'), 'loading_log')).toHaveLength(1);
    expect(of(parse('POWER CUT--9:40 AM'), 'power_cut')[0].time).toBe('09:40');
    expect(of(parse('Power cut 10:15 am\nPower in 11:00 am\nPower cut 11:10 am\nPower in 11:45 am'), 'power_cut')).toHaveLength(1);
    const chat = parse('Dear Sir, please check');
    expect(chat.flags[0]).toMatchObject({ severity: 'info', reason: 'conversation — no figures to read' });
  });

  test('a message of no known shape is flagged for action, with its text', () => {
    const r = parse('Something 12 about 34');
    expect(r.records).toHaveLength(0);
    expect(actions(r)[0]).toMatchObject({ reason: 'message has no recognised shape', text: 'Something 12 about 34' });
  });

  test('deleted and system messages are counted, not flagged', () => {
    const r = parseMessages([msg('This message was deleted'), msg('You created this group', { system: true, author: null })]);
    expect(r.flags).toHaveLength(0);
    expect(r.stats.system).toBe(2);
  });
});

test('nothing is dropped: every real message yields a record or a flag', () => {
  const bodies = [
    '16/09/26/ in time\n1) ANIL', 'CUSTOMER A\nPICKLING TIME 9:30 AM', '<Media omitted>', 'ok',
    '15/4/26/ out time all 5pm', 'Something 12 about 34', 'Weekly payment\nx', '07/09/26/ BOOK\n---\nA\nB',
    '17/09/26/ festival holiday',
  ];
  const msgs = bodies.map((b, i) => msg(b, { time: `10:${String(i).padStart(2, '0')}`, media: b.startsWith('<') }));
  const r = parseMessages(msgs);
  const hit = new Set([...r.records, ...r.flags].map((x) => x.src.key));
  for (const m of msgs) expect(hit.has(messageKey(m))).toBe(true);
});

test('classify sorts the shapes', () => {
  expect(classify('16/09/26/ in time\n1) ANIL')).toBe('attendance');
  expect(classify('Incoming Material\nX')).toBe('incoming');
  expect(classify('Dear sir')).toBe('chat');
});
