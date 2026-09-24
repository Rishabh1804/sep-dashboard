// WhatsApp chat export → messages. Layer 1: pure, no DOM, no storage.
//
// Two export shapes reach us (Session 20, ⚠ B — intake is the exported chat):
//   Android:   16/09/2026, 4:13 pm - Name: body
//   iOS/tool:  [9/16/26, 4:13:26 PM] Name: body
// Either can carry a leading U+200E mark. A line that does not open a new
// message continues the previous one. Day/month order is locale-dependent,
// so it is detected per file (a field > 12 settles it) with a per-shape
// default when every date in the file is ambiguous.

const ANDROID_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?\s+-\s+(.*)$/i;
const BRACKET_RE = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?\]\s*(?:-\s+)?(.*)$/i;

const MEDIA_RE = /^<(?:media omitted|image omitted|video omitted|audio omitted|sticker omitted|document omitted|gif omitted|album message)>$|^(?:image|video|audio|sticker|document) omitted$/i;

function stripMarks(s) {
  return s.replace(/[‎‏‪-‮﻿]/g, '');
}

function matchHead(line) {
  const a = ANDROID_RE.exec(line);
  if (a) return { shape: 'android', m: a };
  const b = BRACKET_RE.exec(line);
  if (b) return { shape: 'bracket', m: b };
  return null;
}

// 'dmy' | 'mdy' for the file. Default: Android exports here are day-first,
// the bracketed tool exports month-first (both observed in the relay corpus).
export function detectDateOrder(lines) {
  let shape = null;
  for (const raw of lines) {
    const h = matchHead(stripMarks(raw));
    if (!h) continue;
    shape = shape || h.shape;
    const x = Number(h.m[1]);
    const y = Number(h.m[2]);
    if (x > 12 && y <= 12) return 'dmy';
    if (y > 12 && x <= 12) return 'mdy';
  }
  return shape === 'bracket' ? 'mdy' : 'dmy';
}

function to24(h, min, ap) {
  let hh = Number(h);
  if (ap) {
    const pm = /p/i.test(ap);
    if (pm && hh < 12) hh += 12;
    if (!pm && hh === 12) hh = 0;
  }
  return `${String(hh).padStart(2, '0')}:${min}`;
}

function fullYear(y) {
  const n = Number(y);
  return n < 100 ? 2000 + n : n;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// FNV-1a, 32-bit, hex. Enough to key a message for de-duplication across
// overlapping exports; not a security primitive.
export function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// Two exports of the same group overlap. The same message has the same
// minute, author and body in both, so this key collapses them (the seconds
// only one shape carries are deliberately left out).
export function messageKey(msg) {
  return `${msg.date}T${msg.time}|${msg.author || ''}|${hash32(msg.body)}`;
}

// text → { order, messages: [{ date, time, author, body, system, media, line }] }
// `line` is the 1-based line in the export where the message starts.
export function splitExport(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const order = detectDateOrder(lines);
  const messages = [];
  let cur = null;

  lines.forEach((raw, i) => {
    const line = stripMarks(raw);
    const h = matchHead(line);
    if (!h) {
      if (cur) cur.bodyLines.push(line);
      return;
    }
    const [, p1, p2, y, hh, mm, ap, rest] = h.m;
    const day = order === 'dmy' ? p1 : p2;
    const month = order === 'dmy' ? p2 : p1;
    const colon = rest.indexOf(': ');
    // A system line ("You created this group") has no "Name: " prefix.
    const system = colon < 0;
    cur = {
      date: `${fullYear(y)}-${pad2(month)}-${pad2(day)}`,
      time: to24(hh, mm, ap),
      author: system ? null : rest.slice(0, colon).trim(),
      bodyLines: [system ? rest : rest.slice(colon + 2)],
      system,
      line: i + 1,
    };
    messages.push(cur);
  });

  for (const m of messages) {
    let body = m.bodyLines.join('\n').replace(/\s*<This message was edited>/gi, '').replace(/\s+$/, '');
    body = body.replace(/^\[Forwarded\]\s*/i, '');
    m.body = body;
    m.media = !m.system && MEDIA_RE.test(body.trim());
    delete m.bodyLines;
  }
  return { order, messages };
}
