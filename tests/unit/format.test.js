import { esc, escAttr } from '../../src/shared/utils/format.js';

describe('esc()', () => {
  test('escapes the text-context metachars', () => {
    expect(esc('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });
  test('deliberately leaves quotes intact (text context)', () => {
    expect(esc('say "hi"')).toBe('say "hi"');
  });
});

describe('escAttr()', () => {
  test('neutralises double and single quotes on top of esc()', () => {
    expect(escAttr('x" onfocus=alert(1) y="')).toBe('x&quot; onfocus=alert(1) y=&quot;');
    expect(escAttr("o'clock")).toBe('o&#39;clock');
  });
  test('a quote-bearing handler value cannot break out of a value="..." attribute', () => {
    const evil = 'bad" autofocus onfocus="alert(1)';
    const attr = `value="${escAttr(evil)}"`;
    // No raw double-quote survives between the opening and closing attribute quote.
    expect(attr.slice('value="'.length, -1)).not.toContain('"');
  });
  test('still escapes < > & like esc', () => {
    expect(escAttr('<b>&')).toBe('&lt;b&gt;&amp;');
  });
});
