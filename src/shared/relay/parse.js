// Relay messages → attendance, production and flagged lines. Layer 1: pure.
//
// The rules come from the shop's own relay and the records that already
// read it by hand (sep-invoicing CLAUDE.md § The floor, by area; §
// Labour and attendance; soma-internal/attendance/). Three rules of the
// house carry over unchanged:
//   · unreadable is a STATE, not a failure — every line lands as a record
//     or as a flag with a reason; nothing is silently dropped;
//   · warn, never block, and say why;
//   · the shop's own arithmetic (`a + b = c`, `add … use … available …`)
//     is checked for footing, and a line that does not foot is flagged.
// Stock lines are read and footed but belong to soma-internal (kickoff ⚖ C);
// they ride the export, they get no tab here.

import { messageKey } from './export.js';

export const SEVERITY = { ACTION: 'action', INFO: 'info' };

const AREA_WORDS = new Set([
  'vat', 'a1', 'a2', 'berral', 'barrel', 'pickling', '&', 'and', 'office',
  'gate', 'keeper', 'monthly', 'weekly', 'absent', 'extra', 'work', 'area',
]);
const AREA_KEYS = ['vat', 'a1', 'a2', 'berral', 'barrel', 'pickling', 'office', 'gate', 'absent'];

// "15/09/26/ in time" — the shop writes the WORK date, day-first.
const ATT_HEAD_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?\s*(in|out)\s*time\b/i;
// "Out time 09/09/26/" — the same header written the other way round.
const ATT_HEAD_REV_RE = /^(in|out)\s*time\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?/i;
const HOLIDAY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?\s*(.*\b(?:holiday|all\s*absent)\b.*)$/i;
// "23/08/26/ Sunday 6:00 am 2 pm", "19/08/26/ night": a crew sheet headed by
// the kind of day rather than "in time".
const ATT_DAY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?\s*(night|sunday|[a-z]+day)\b(.*)$/i;
// "Baki sab 5:00 pm out" (all the rest), "ALL 5:00 PM OUT", "OUT TIME 5 PM ALL".
const ALL_OUT_RE = /^(?:(?:baki\s*sab|all)\b.*\bout\b|out\s*time\b.*\ball\b|all\s*out\b)/i;
// "----6:00 AM---", "---hold night-6:00am---", "-----8:00 PM----"
// Also "----in time 2:00 pm---": a block that names its direction.
const BLOCK_RE = /^[-–—\s]*(?:(?:in|out)\s*time\s*)?(hold\s*night\s*[-–—]*\s*)?(\d{1,2})(?:\s*[:.]\s*(\d{2})?)?\s*([ap]\.?\s?m\.?)?(?:\s*(?:to|-|–)\s*\d{1,2}(?:\s*[:.]\s*\d{2})?\s*(?:[ap]\.?\s?m\.?)?)?[-–—\s]*$/i;
const WORKER_RE = /^0*(\d{1,3})\s*(?:\)\.?|\.)\s*(.+)$/;
const EXTRA_RE = /\bextra\b\s*[-–—:]*\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i;
const QTY_UNITS = 'nos|no|pcs|pc|kgs|kg|bags|bag';
const QTY_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${QTY_UNITS})\\b\\.?`, 'gi');
const HAS_QTY_RE = new RegExp(`\\d\\s*(?:${QTY_UNITS})\\b`, 'i');
const QTY_ONLY_RE = new RegExp(`^\\s*(\\d+(?:\\.\\d+)?)\\s*(${QTY_UNITS})\\b\\.?\\s*$`, 'i');
// A chain ("140×94=35×6=400") is size notation, not a sum: only a lone
// `a op b = c` with no operator touching either end is checked.
const ARITH_RE = /(?<![\d.])(?<!\b[A-Za-z]\s?)(?<![\d.]\s*[+×x*\-=]\s*)(\d+(?:\.\d+)?)\s*([+×x*\-])\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)(?![\d.])(?!\s*[+×x*\-=]\s*\d)/gi;
// "PICKLINY", "PICKLIBG", "PCKLING" — the word is typed fast.
const PICKLING_TIME_RE = /(?:^|\s)p\p{L}{3,9}\s*time\W*(\d{1,2})\s*(?:[:.]\s*(\d{2})?)?\s*([a-z.\s]*)$/iu;
const INCOMING_RE = /^incoming\s*material\b(?:.*?\btime\W*(\d{1,2})\s*[:.]\s*(\d{2})\s*([ap]\.?\s?m\.?)?)?/i;
// A dated production log: "7/1/26/", "Sunday/11/01/2026/".
const DATE_LINE_RE = /^(?:[a-z]+\s*\/\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})\/?\s*(?:[a-z ]*\bproduction\b[a-z ]*)?$/i;
const PAYMENT_RE = /\b(weekly|monthly)\s*payment\b/i;
const STOCK_HEAD_RE = /\bsto(?:c)?k\b/i;
// "Q558- 40Kg", "65M- Nil", "A Salt - 60 Litre", "106 Salt nil"
const STOCK_LEVEL_RE = /\b(?:nil|\d+(?:\.\d+)?\s*(?:kgs?|ltr|litres?|liters?|l)\b)/i;
// Stock is also counted in pieces (spray cans) — a unit only a stock line may use.
const STOCK_QTY_RE = /(\d+(?:\.\d+)?)\s*(?:ltr|litres?|liters?|kgs?|nos|l)\b/gi;
// "9 am mk 120×4  10am mk120×4": a barrel loading log, time after time.
const LOADING_LOG_RE = /\d{1,2}(?:[:.]\d{2})?\s*[ap]\.?m/gi;
// "RUPA 8:30 am 5:00 pm", "BHANU 8:30-5 PM": a name then a clock time.
const WORKER_TIME_RE = /^[a-z .*⭐]+\(?\s*\d{1,2}(?:[:.]\d{2}|\s*[ap]\.?m)/i;
const ARITH_TEST_RE = /\d\s*[+×x*\-]\s*\d+(?:\.\d+)?\s*=\s*\d/;
const POWER_CUT_RE = /\bp[ao]w[ae]r\s*cut\b\W*(?:(\d{1,2})[:.](\d{2})\s*([ap]\.?\s?m\.?)?)?/i;
const DELETED_RE = /^(?:this message was deleted|you deleted this message)$/i;
const STOCK_UNIT_RE = /\b(ltr|litre|liter|l|kg|kgs)\b/i;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function workDate(d, m, y) {
  const yy = Number(y) < 100 ? 2000 + Number(y) : Number(y);
  return `${yy}-${pad2(m)}-${pad2(d)}`;
}

function to24(h, min, ap) {
  let hh = Number(h);
  if (ap) {
    const pm = /p/i.test(ap);
    if (pm && hh < 12) hh += 12;
    if (!pm && hh === 12) hh = 0;
  }
  return `${pad2(hh)}:${min}`;
}

function unitOf(u) {
  const x = u.toLowerCase();
  if (x.startsWith('kg')) return 'kg';
  if (x.startsWith('bag')) return 'bag';
  if (x.startsWith('l')) return 'ltr';
  return 'nos';
}

function num(s) {
  return Number(s);
}

// Every `a op b = c` the shop wrote on a line, checked.
export function checkArithmetic(text) {
  const bad = [];
  for (const m of text.matchAll(ARITH_RE)) {
    const [whole, a, op, b, c] = m;
    const x = num(a);
    const y = num(b);
    // "90×94=460" is a part's size then its count, not a product.
    if (op !== '+' && op !== '-' && x >= 50 && y >= 50) continue;
    let v;
    if (op === '+') v = x + y;
    else if (op === '-') v = x - y;
    else v = x * y;
    if (Math.abs(v - num(c)) > 0.001) bad.push({ expr: whole.trim(), computed: v, written: num(c) });
  }
  return bad;
}

// The last quantity on a line: "3301-600 nos" → 600 nos (the leading
// number is a part code, not a count).
export function lineQuantity(text) {
  let last = null;
  for (const m of text.matchAll(QTY_RE)) last = { qty: num(m[1]), unit: unitOf(m[2]) };
  return last;
}

// Token-set test: a line is an area header when every word in it is area
// vocabulary and at least one is a key word. "VAT A 2", "---berral &
// pickling---", "office & gate keeper", "--monthly- absent---".
export function readAreaHeader(line) {
  const norm = line
    .toLowerCase()
    .replace(/[-–—_*:|]+/g, ' ')
    .replace(/\ba\s*([12])\b/g, 'a$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return null;
  const toks = norm.split(' ');
  if (!toks.every((t) => AREA_WORDS.has(t))) return null;
  if (!toks.some((t) => AREA_KEYS.includes(t))) return null;
  const has = (t) => toks.includes(t);
  const extraWork = has('extra') && has('work');

  if (has('absent')) {
    return { areas: [], absent: has('monthly') ? 'monthly' : has('weekly') ? 'weekly' : 'unspecified', extraWork };
  }
  const areas = [];
  const barrel = has('barrel') || has('berral');
  const a1 = has('a1');
  const a2 = has('a2');
  if (has('office')) areas.push('office');
  if (has('gate')) areas.push('gate');
  if (barrel) {
    areas.push('barrel');
    // Barrel and barrel pickling are one unit for the arithmetic (norm 5).
    if (has('pickling')) areas.push('barrel-pickling');
  } else if (has('pickling')) {
    const vatNamed = has('vat');
    if (a1 && a2) areas.push('pickling-a1', 'pickling-a2');
    else if (a1 && !vatNamed && toks.indexOf('a1') < toks.indexOf('pickling')) areas.push('vat-a1', 'pickling');
    else if (a1) areas.push('pickling-a1');
    else if (a2) areas.push('pickling-a2');
    else areas.push('pickling');
  } else {
    if (a1) areas.push('vat-a1');
    if (a2) areas.push('vat-a2');
  }
  if (!areas.length) return null;
  return { areas, absent: null, extraWork };
}

// Shop hours settle a time written without am/pm: 6–11 is morning.
function shopTime(h, min, ap) {
  const hh = Number(h);
  return to24(h, min || '00', ap || (hh >= 6 && hh <= 11 ? 'am' : 'pm'));
}

// "UDAY 7:00 PM", "RUPA 8:30 am 5:00 pm", "BHANU 8:30-5 PM",
// "⭐ **NAME (8:30 AM)**". One time is the time the line is about; two are
// an in/out pair.
function readWorker(text) {
  const rest = text.replace(/[*_⭐]/g, '').trim();
  const cut = rest.search(/[\d(]/);
  const name = (cut < 0 ? rest : rest.slice(0, cut)).replace(/[-–—,\s]+$/, '').replace(/\s+/g, ' ').toUpperCase();
  const tail = cut < 0 ? '' : rest.slice(cut);
  const times = [...tail.matchAll(/(\d{1,2})(?:\s*[:.]\s*(\d{2})?)?\s*([ap]\.?\s?m\.?)?/gi)]
    .filter((m) => m[2] || m[3])
    .map((m) => shopTime(m[1], m[2], m[3]));
  const junk = tail
    .replace(/(\d{1,2})(?:\s*[:.]\s*(\d{2})?)?\s*([ap]\.?\s?m\.?)?/gi, '')
    .replace(/\b(?:in|out|to|and)\b/gi, '')
    .replace(/[-–—()\s,:.&]/g, '');
  return {
    name: junk ? `${name} ${tail}`.trim().toUpperCase() : name,
    time: times.length === 1 ? times[0] : null,
    inTime: times.length === 2 ? times[0] : null,
    outTime: times.length === 2 ? times[1] : null,
  };
}

function looksLikeName(s) {
  return /^[A-Za-z][A-Za-z .'-]{0,40}$/.test(s) && !HAS_QTY_RE.test(s);
}

// ---------------------------------------------------------------------------

function src(msg, lineNo) {
  return { key: messageKey(msg), date: msg.date, time: msg.time, author: msg.author, line: lineNo };
}

function flag(out, msg, lineNo, severity, reason, text) {
  out.flags.push({ severity, reason, text, src: src(msg, lineNo) });
}

function footArithmetic(out, msg, lineNo, text) {
  for (const b of checkArithmetic(text)) {
    flag(out, msg, lineNo, SEVERITY.ACTION, `does not foot: ${b.expr} (computes ${b.computed})`, text);
  }
}

function parseAttendance(msg, lines, head, out) {
  const date = workDate(head[1], head[2], head[3]);
  const direction = head[4].toLowerCase();
  const block = { time: null, holdNight: false };
  // The message itself is the first crew: header-dated sheets ("20/06/26/
  // in time 8:30 am out time 5:00 pm") never open a block.
  let group = { areas: [], absent: null, extraWork: false, names: [], implicit: true };
  let stockMode = false;
  let pending = null; // text line waiting for a qty-only line under it

  const sendDelta = Math.round((Date.parse(msg.date) - Date.parse(date)) / 86400000);
  if (Number.isNaN(sendDelta) || sendDelta < 0 || sendDelta > 7) {
    flag(out, msg, 0, SEVERITY.ACTION, `work date ${date} is ${Number.isNaN(sendDelta) ? 'unreadable' : `${sendDelta} day(s) from the send date`}`, lines[0]);
  }

  // "15/4/26/ out time all 5pm": the whole sheet in its header.
  const tail = lines[0].trim().slice(head[0].length);
  const ht = /(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*([ap]\.?\s?m\.?)/i.exec(tail);
  if (ht) block.time = shopTime(ht[1], ht[2], ht[3]);
  if (/\ball\b/i.test(tail)) {
    out.records.push({ type: 'all_out', date, direction, block: { ...block }, time: block.time, src: src(msg, 0) });
  }

  const openGroup = (g) => {
    group = { ...g, names: [] };
  };

  const flushPending = () => {
    if (pending) {
      flag(out, msg, pending.lineNo, SEVERITY.INFO, 'free text with no quantity — context only', pending.text);
      pending = null;
    }
  };

  lines.slice(1).forEach((rawLine, i) => {
    const lineNo = i + 1;
    const text = rawLine.trim();
    if (!text) return;
    if (!/[a-z0-9]/i.test(text)) {
      // A rule of dashes separates one crew from the next.
      flushPending();
      if (group.names.length || group.areas.length) group = { areas: [], absent: null, extraWork: false, names: [], implicit: true };
      return;
    }
    footArithmetic(out, msg, lineNo, text);

    const blk = BLOCK_RE.exec(text);
    if (blk && (blk[3] || blk[4])) {
      flushPending();
      if (!blk[3] && !blk[4]) {
        // A bare number is not a clock time; let the line fall through.
      } else {
        block.time = shopTime(blk[2], blk[3], blk[4]);
      block.holdNight = Boolean(blk[1]);
      // Early and OT crews are often listed straight under the block with
      // no area heading; the block itself is their group, so an EXTRA tag
      // under them books to that crew.
        group = { areas: [], absent: null, extraWork: false, names: [], implicit: true };
        return;
      }
    }
    const area = readAreaHeader(text);
    if (area) {
      flushPending();
      openGroup(area);
      return;
    }
    if (ALL_OUT_RE.test(text)) {
      const t = /(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*([ap]\.?\s?m\.?)/i.exec(text);
      flushPending();
      out.records.push({ type: 'all_out', date, direction, block: { ...block }, time: t ? shopTime(t[1], t[2], t[3]) : block.time, src: src(msg, lineNo) });
      return;
    }
    // "Vat A 2 --- Extra 3 hours": an area heading and its tag on one line.
    const exAt = text.search(/\bextra\b/i);
    if (exAt > 0 && EXTRA_RE.test(text)) {
      const head = readAreaHeader(text.slice(0, exAt));
      if (head) {
        flushPending();
        openGroup(head);
      }
    }
    const ex = EXTRA_RE.exec(text);
    if (ex) {
      flushPending();
      if (!group.areas.length && !group.names.length) flag(out, msg, lineNo, SEVERITY.ACTION, 'EXTRA tag with no crew or area above it', text);
      else if (!group.areas.length) flag(out, msg, lineNo, SEVERITY.INFO, 'EXTRA booked to a crew with no area named — cannot be checked against a shortfall', text);
      out.records.push({
        type: 'extra',
        date,
        block: { ...block },
        areas: group.areas,
        heads: group.names.length,
        hours: num(ex[1]),
        src: src(msg, lineNo),
      });
      return;
    }
    // "SAMBHU 12:00 AM": a crew line written without its number.
    const w = WORKER_RE.exec(text) || (WORKER_TIME_RE.test(text) && looksLikeName(readWorker(text).name) ? [text, null, text] : null);
    // A stock take written under the crew list: numbered, and carrying a
    // unit, a NIL or the shop's own arithmetic.
    if (w && (stockMode || STOCK_LEVEL_RE.test(w[2]) || ARITH_TEST_RE.test(w[2])) && /\d|\bnil\b/i.test(w[2]) && !WORKER_TIME_RE.test(w[2])) {
      flushPending();
      stockMode = true;
      stockRecord(out, msg, lineNo, text, date);
      return;
    }
    if (w) {
      flushPending();
      const { name, time, inTime, outTime } = readWorker(w[2]);
      if (!looksLikeName(name)) {
        // A numbered line that is not a name — usually a count or an item.
        flag(out, msg, lineNo, SEVERITY.ACTION, 'numbered line that does not read as a name', text);
        return;
      }
      const { absent } = group;
      if (group.implicit && !group.areas.length && block.time === null && direction === 'in') {
        flag(out, msg, lineNo, SEVERITY.INFO, 'worker listed before any area heading', text);
      }
      out.records.push({
        type: 'attendance',
        date,
        direction,
        block: { ...block },
        areas: group.areas,
        name,
        status: absent ? 'absent' : 'present',
        absentClass: absent || null,
        time,
        inTime,
        outTime,
        extraWork: Boolean(group.extraWork),
        src: src(msg, lineNo),
      });
      if (!absent) group.names.push(name);
      return;
    }
    if (QTY_ONLY_RE.test(text) && pending) {
      const q = lineQuantity(text);
      out.records.push({
        type: 'production', date, block: { ...block }, areas: group.areas,
        text: `${pending.text} ${text}`, qty: q.qty, unit: q.unit, src: src(msg, pending.lineNo),
      });
      pending = null;
      return;
    }
    const q = lineQuantity(text);
    if (q) {
      flushPending();
      out.records.push({
        type: 'production', date, block: { ...block }, areas: group.areas,
        text, qty: q.qty, unit: q.unit, src: src(msg, lineNo),
      });
      return;
    }
    flushPending();
    pending = { text, lineNo };
  });
  flushPending();
}

function parsePickling(msg, lines, out) {
  const items = [];
  let time = null;
  let customer = null;
  lines.forEach((raw, lineNo) => {
    const text = raw.trim();
    if (!text) return;
    footArithmetic(out, msg, lineNo, text);
    const pt = PICKLING_TIME_RE.exec(text);
    if (pt) {
      const suffix = pt[3].trim();
      const mins = pt[2] || '00';
      if (!pt[2]) flag(out, msg, lineNo, SEVERITY.INFO, 'pickling time has no minutes — read as :00', text);
      if (/^[ap]\.?\s?m\.?$/i.test(suffix)) {
        time = to24(pt[1], mins, suffix);
      } else {
        // Shop hours: 6–11 is morning, 12–5 afternoon.
        const h = Number(pt[1]);
        time = to24(pt[1], mins, h >= 6 && h <= 11 ? 'am' : 'pm');
        flag(out, msg, lineNo, SEVERITY.INFO, `pickling time has no am/pm${suffix ? ` ("${suffix}")` : ''} — read as ${time}`, text);
      }
      return;
    }
    if (customer === null) {
      customer = text.replace(/[-–—]+$/, '').trim();
      const q = lineQuantity(text);
      if (!q) return;
    }
    const q = lineQuantity(text);
    items.push({ text, qty: q ? q.qty : null, unit: q ? q.unit : null, line: lineNo });
  });
  out.records.push({ type: 'pickling', date: msg.date, customer, items, time, src: src(msg, 0) });
}

// "BRIGHTNER 80 LTR 6 day 5×6=30use available 50LTR"
// "NITRIC ACID add 60+10=70 LTR use 6 day 30 LTR available 70 LTR"
export function readStockLine(text) {
  const body = text.replace(/^0*\d{1,3}\s*(?:\)\.?|\.)\s*/, '');
  // The older take writes the whole line as a subtraction: "Q558 30-4=26 KG"
  // is opening 30, used 4, left 26. That footing is the arithmetic check's
  // job; here it only places the three numbers.
  const sub = /(?<![\d.])(?<!\b[A-Za-z]\s?)(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)/.exec(body);
  if (sub && sub.index > 0 && !/\badd\b/i.test(body)) {
    const unitAfter = STOCK_UNIT_RE.exec(body.slice(sub.index)) || /\bnos\b/i.exec(body.slice(sub.index));
    return {
      item: body.slice(0, sub.index).replace(/[-–—:=\s]+$/, '').trim().toUpperCase(),
      unit: unitAfter ? unitOf(unitAfter[0]) : null,
      start: num(sub[1]),
      use: num(sub[2]),
      available: num(sub[3]),
      nil: /\bnil\b/i.test(body),
      // Footed by checkArithmetic on the same line; not double-flagged here.
      foots: null,
    };
  }
  // The opening level is the first number carrying a unit ("65 M 21 LTR":
  // the 65 is part of the item's name); the name is what precedes it.
  const firstQty = [...body.matchAll(STOCK_QTY_RE)].find((m) => m.index > 0) || null;
  const cut = [firstQty ? firstQty.index : -1, body.search(/\b(?:add|nil|use)\b/i)].filter((i) => i >= 0);
  const nameEnd = cut.length ? Math.min(...cut) : body.length;
  const item = body.slice(0, nameEnd).replace(/[-–—:=\s]+$/, '').trim().toUpperCase();
  const unitM = firstQty ? /[a-z]+$/i.exec(firstQty[0].trim()) : STOCK_UNIT_RE.exec(body);
  const unit = unitM ? unitOf(unitM[0]) : null;

  let start = null;
  const add = /\badd\b\s*([\d.+\s]+?)(?:=\s*(\d+(?:\.\d+)?))?(?=\s*[a-z]|$)/i.exec(body);
  if (add) {
    start = add[2] != null ? num(add[2]) : add[1].split('+').map((s) => num(s.trim())).reduce((a, b) => a + b, 0);
  } else if (firstQty) {
    start = num(firstQty[1]);
  }
  // Consumption is the last number written before "available" once a
  // "use" has appeared — "use 6 day 30 LTR available", "3×6=18 LTR use
  // available", "use 21/09/26/ 300 LTR available" all put it there.
  let use = null;
  const useAt = body.search(/use\b/i);
  if (useAt >= 0) {
    const availAt = body.search(/\bavailable\b/i);
    const seg = body.slice(0, availAt >= 0 ? availAt : body.length);
    const nums = [...seg.slice(useAt).matchAll(/(\d+(?:\.\d+)?)(?!\s*\/)/g)];
    const before = [...seg.matchAll(/(\d+(?:\.\d+)?)\s*(?:ltr|litre|kgs?|l)?\s*use\b/gi)];
    if (nums.length && availAt >= 0) use = num(nums[nums.length - 1][1]);
    else if (before.length) use = num(before[before.length - 1][1]);
    else if (nums.length) use = num(nums[nums.length - 1][1]);
    if (use === null && before.length) use = num(before[before.length - 1][1]);
  }
  const av = /\bavailable\b\s*(\d+(?:\.\d+)?)/i.exec(body);
  const available = av ? num(av[1]) : null;
  const nil = /\bnil\b/i.test(body);

  let foots = null;
  if (start != null && use != null && available != null) foots = Math.abs(start - use - available) < 0.001;
  return { item, unit, start, use, available, nil, foots };
}

function stockRecord(out, msg, lineNo, text, date) {
  const s = readStockLine(text);
  if (!s.item || (s.start == null && !s.nil)) {
    // Stock messages also carry transport and order notes; kept, not scored.
    flag(out, msg, lineNo, SEVERITY.INFO, 'line in a stock take with no level', text);
    return;
  }
  out.records.push({ type: 'stock', date, ...s, text, src: src(msg, lineNo) });
  if (s.foots === false) {
    const calc = s.start - s.use;
    flag(out, msg, lineNo, SEVERITY.ACTION, `stock does not foot: ${s.start} − ${s.use} = ${calc}, relay says ${s.available}`, text);
  }
}

function parseStock(msg, lines, out) {
  let date = msg.date;
  lines.forEach((raw, lineNo) => {
    const text = raw.trim();
    if (!/[a-z0-9]/i.test(text)) return; // blank or a rule of dashes
    footArithmetic(out, msg, lineNo, text);
    // A heading ("STOK 31/1/26", "31/1/26/") dates the take; it is not a line of it.
    const d = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(text);
    if (!STOCK_LEVEL_RE.test(text) && (STOCK_HEAD_RE.test(text) || DATE_LINE_RE.test(text))) {
      if (d) date = workDate(d[1], d[2], d[3]);
      return;
    }
    stockRecord(out, msg, lineNo, text, date);
  });
}

function parseIncoming(msg, lines, out) {
  const head = INCOMING_RE.exec(lines.find((l) => l.trim()).trim());
  const time = head && head[1] ? to24(head[1], head[2], head[3]) : null;
  let party = null;
  const items = [];
  lines.forEach((raw, lineNo) => {
    const text = raw.trim();
    if (!text || INCOMING_RE.test(text)) return;
    const q = lineQuantity(text);
    if (!q && party === null) { party = text; return; }
    items.push({ text, qty: q ? q.qty : null, unit: q ? q.unit : null, line: lineNo });
  });
  out.records.push({ type: 'incoming', date: msg.date, time, party, items, src: src(msg, 0) });
  if (!items.some((i) => i.qty != null)) flag(out, msg, 0, SEVERITY.INFO, 'incoming material with no quantity', lines.join('\n').trim());
}

// "7/1/26/" then one item per line: the older daily production log.
function parseProductionLog(msg, lines, out) {
  const first = lines.findIndex((l) => l.trim());
  const d = DATE_LINE_RE.exec(lines[first].trim());
  const date = workDate(d[1], d[2], d[3]);
  let pending = null;
  const flush = () => {
    if (pending) flag(out, msg, pending.lineNo, SEVERITY.INFO, 'production line with no quantity', pending.text);
    pending = null;
  };
  lines.slice(first + 1).forEach((raw, i) => {
    const text = raw.trim();
    const lineNo = first + 1 + i;
    if (!/[a-z0-9]/i.test(text)) return;
    footArithmetic(out, msg, lineNo, text);
    const q = lineQuantity(text);
    if (q && pending && QTY_ONLY_RE.test(text)) {
      out.records.push({ type: 'production', date, block: null, areas: [], text: `${pending.text} ${text}`, qty: q.qty, unit: q.unit, src: src(msg, pending.lineNo) });
      pending = null;
    } else if (q) {
      flush();
      out.records.push({ type: 'production', date, block: null, areas: [], text, qty: q.qty, unit: q.unit, src: src(msg, lineNo) });
    } else {
      flush();
      pending = { text, lineNo };
    }
  });
  flush();
}

// A continuation line that carries the use/available half of the line above
// it ("HCL add 660 LTR" / "use 21/09/26/ 300 LTR available 360 LTR").
function joinStockContinuations(lines) {
  const out = [];
  for (const l of lines) {
    const t = l.trim();
    if (out.length && /^(use|available)\b/i.test(t)) out[out.length - 1] += ` ${t}`;
    else out.push(l);
  }
  return out;
}

export function classify(body) {
  const lines = body.split('\n');
  const first = lines.find((l) => l.trim()) || '';
  if (ATT_HEAD_RE.test(first.trim())) return 'attendance';
  if (lines.length === 1 && HOLIDAY_RE.test(first.trim())) return 'holiday';
  if (INCOMING_RE.test(first.trim())) return 'incoming';
  if (PAYMENT_RE.test(first)) return 'payment';
  if (lines.some((l) => PICKLING_TIME_RE.test(l.trim()))) return 'pickling';
  const filled = lines.filter((l) => l.trim());
  const stocky = filled.filter((l) => STOCK_UNIT_RE.test(l) && (/\b(use|available|add|nil)\b/i.test(l) || WORKER_RE.test(l.trim())));
  if (stocky.length >= 2 && lines.some((l) => /\b(use|available)\b/i.test(l))) return 'stock';
  const levels = filled.filter((l) => STOCK_LEVEL_RE.test(l) && !HAS_QTY_RE.test(l.replace(/\bkgs?\b/gi, '')));
  if (STOCK_HEAD_RE.test(first) || (levels.length >= 3 && levels.length >= filled.length / 2 && filled.some((l) => /\b(nil|stock|ltr|litre|liter)\b/i.test(l)))) return 'stock';
  if (DATE_LINE_RE.test(first.trim()) && filled.slice(1).some((l) => HAS_QTY_RE.test(l))) return 'production';
  if ((body.match(LOADING_LOG_RE) || []).length >= 2 && /[×x]\s*\d/.test(body)) return 'loading';
  if (!/\d/.test(body)) return 'chat';
  return 'unknown';
}

// messages (from splitExport) → { records, flags, stats }
export function parseMessages(messages) {
  const out = { records: [], flags: [] };
  const stats = { messages: 0, system: 0, media: 0, attendance: 0, pickling: 0, stock: 0, holiday: 0, powerCut: 0, incoming: 0, payment: 0, production: 0, loading: 0, chat: 0, unknown: 0 };

  for (const msg of messages) {
    stats.messages++;
    const before = out.records.length + out.flags.length;
    parseOne(msg, out, stats);
    // Backstop for the house rule: a message that yielded nothing is still
    // shown, so no reader gap can drop one silently.
    if (out.records.length + out.flags.length === before && !msg.system && msg.body.trim() && !DELETED_RE.test(msg.body.trim())) {
      flag(out, msg, 0, SEVERITY.ACTION, 'read, but nothing was recorded from it', msg.body.trim());
    }
  }
  return { ...out, stats };
}

function parseOne(msg, out, stats) {
  if (msg.system) { stats.system++; return; }
  if (msg.media) {
    stats.media++;
    flag(out, msg, 0, SEVERITY.INFO, 'photo or media — not readable here', msg.body.trim());
    return;
  }
  if (!msg.body.trim()) return;
  if (DELETED_RE.test(msg.body.trim())) { stats.system++; return; }

  // A message can carry a trailing holiday line after attendance
  // ("17/09/26/ Vishwakarma puja holiday"); peel those off first.
  const lines = [];
  msg.body.split('\n').forEach((l, i) => {
    const h = HOLIDAY_RE.exec(l.trim());
    if (h && i > 0) {
      out.records.push({ type: 'holiday', date: workDate(h[1], h[2], h[3]), label: h[4].trim(), src: src(msg, i) });
      stats.holiday++;
      lines.push('');
    } else lines.push(l);
  });

  const pc = POWER_CUT_RE.exec(msg.body);
  const pcLines = msg.body.trim().split('\n').filter((l) => l.trim());
  if (pc && (pcLines.length <= 3 || pcLines.every((l) => /\bp[ao]w[ae]r\s*(?:cut|in|on|back|came)\b/i.test(l)))) {
    stats.powerCut++;
    out.records.push({
      type: 'power_cut', date: msg.date, time: pc[1] ? to24(pc[1], pc[2], pc[3]) : null,
      text: msg.body.trim(), src: src(msg, 0),
    });
    if (!pc[1]) flag(out, msg, 0, SEVERITY.INFO, 'power cut with no time', msg.body.trim());
    return;
  }

  let labelDay = null;
  const fi = lines.findIndex((l) => l.trim());
  const rev = fi >= 0 && ATT_HEAD_REV_RE.exec(lines[fi].trim());
  if (rev) lines[fi] = `${rev[2]}/${rev[3]}/${rev[4]}/ ${rev[1]} time${lines[fi].trim().slice(rev[0].length)}`;

  const day = fi >= 0 && ATT_DAY_RE.exec(lines[fi].trim());
  if (day && lines.filter((l) => WORKER_RE.test(l.trim())).length >= 2) {
    lines[fi] = `${day[1]}/${day[2]}/${day[3]}/ in time ${day[5].trim()}`;
    labelDay = day[4].toLowerCase();
  }

  const kind = classify(lines.join('\n'));
  stats[kind]++;
  if (kind === 'attendance') {
    const first = lines.findIndex((l) => l.trim());
    const from = out.records.length;
    parseAttendance(msg, lines.slice(first), ATT_HEAD_RE.exec(lines[first].trim()), out);
    if (labelDay) for (const r of out.records.slice(from)) r.day = labelDay;
  } else if (kind === 'holiday') {
    const h = HOLIDAY_RE.exec(lines.find((l) => l.trim()).trim());
    out.records.push({ type: 'holiday', date: workDate(h[1], h[2], h[3]), label: h[4].trim(), src: src(msg, 0) });
  } else if (kind === 'pickling') {
    parsePickling(msg, lines, out);
  } else if (kind === 'stock') {
    parseStock(msg, joinStockContinuations(lines), out);
  } else if (kind === 'incoming') {
    parseIncoming(msg, lines, out);
  } else if (kind === 'production') {
    parseProductionLog(msg, lines, out);
  } else if (kind === 'payment') {
    // A payout slip: kept whole for the payroll view, not itemised yet.
    out.records.push({ type: 'payment_slip', date: msg.date, period: PAYMENT_RE.exec(msg.body)[1].toLowerCase(), text: msg.body.trim(), src: src(msg, 0) });
    footArithmetic(out, msg, 0, msg.body);
  } else if (kind === 'loading') {
    // Kept whole, not itemised: its codes ("mk", "ck", "rk") are not decoded yet.
    out.records.push({ type: 'loading_log', date: msg.date, text: msg.body.trim(), src: src(msg, 0) });
    flag(out, msg, 0, SEVERITY.INFO, 'barrel loading log — kept as text, codes not decoded', msg.body.trim());
  } else if (kind === 'chat') {
    flag(out, msg, 0, SEVERITY.INFO, 'conversation — no figures to read', msg.body.trim());
  } else {
    flag(out, msg, 0, SEVERITY.ACTION, 'message has no recognised shape', msg.body.trim());
  }
}
