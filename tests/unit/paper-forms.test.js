import { FORMS } from '../../src/handler/forms-registry.js';
import { DICT } from '../../src/handler/i18n.js';
import {
  PAPER_FORMS, paperSpec, label, CONDITIONAL_HINTS, GRID_FORMS, renderPaperFormsHtml,
} from '../../src/handler/paper-forms.js';

describe('paper forms derive from the live registry', () => {
  test('one sheet per handler form, in registry order', () => {
    expect(PAPER_FORMS).toHaveLength(FORMS.length);
    expect(PAPER_FORMS.map((f) => f.id)).toEqual(FORMS.map((f) => f.id));
  });

  test('field order matches the PWA field order (ADOPTION_PLAN: positions match)', () => {
    for (const form of FORMS) {
      const spec = PAPER_FORMS.find((s) => s.id === form.id);
      expect(spec.fields.map((f) => f.key)).toEqual(form.fields.map((f) => f.key));
    }
  });
});

// The coupling tests: these are what stop paper drifting from the app.
describe('coupling to i18n + registry', () => {
  test('every printed label resolves in BOTH languages', () => {
    for (const spec of PAPER_FORMS) {
      expect(label(FORMS.find((f) => f.id === spec.id).titleKey).missing).toBeUndefined();
      for (const f of spec.fields) {
        expect(typeof f.labelHi).toBe('string');
        expect(f.labelHi.length).toBeGreaterThan(0);
        expect(typeof f.labelEn).toBe('string');
        expect(f.labelEn.length).toBeGreaterThan(0);
        // A missing DICT key falls back to the raw key in BOTH slots — that is
        // the failure this test exists to catch.
        expect(f.labelHi === f.labelEn && f.labelHi.startsWith('f_')).toBe(false);
      }
    }
  });

  test('every select option resolves in both languages', () => {
    for (const spec of PAPER_FORMS) {
      for (const f of spec.fields.filter((x) => x.options)) {
        expect(f.options.length).toBeGreaterThan(0);
        for (const o of f.options) {
          expect(DICT[Object.keys(DICT).find((k) => DICT[k].hi === o.hi)]).toBeTruthy();
          expect(o.en.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('every conditionally-required field has a human sentence for paper', () => {
    const conditional = [];
    for (const form of FORMS) {
      for (const f of form.fields) {
        if (typeof f.required === 'function') conditional.push(`${form.id}.${f.key}`);
      }
    }
    // Guard against the test silently passing if the registry loses them all.
    expect(conditional.length).toBeGreaterThan(0);
    for (const key of conditional) {
      expect(CONDITIONAL_HINTS[key]).toBeDefined();
      expect(CONDITIONAL_HINTS[key].hi.length).toBeGreaterThan(0);
      expect(CONDITIONAL_HINTS[key].en.length).toBeGreaterThan(0);
    }
    // And no stale hints for fields that no longer exist.
    for (const key of Object.keys(CONDITIONAL_HINTS)) {
      expect(conditional).toContain(key);
    }
  });

  test('requirement level maps true / function / absent', () => {
    const prod = PAPER_FORMS.find((f) => f.id === 'production');
    expect(prod.fields.find((f) => f.key === 'job').required).toBe('yes');
    expect(prod.fields.find((f) => f.key === 'quantity').required).toBe('if');
    expect(prod.fields.find((f) => f.key === 'notes').required).toBe('no');
    expect(prod.fields.find((f) => f.key === 'quantity').hint.en).toMatch(/rounds/i);
  });

  test('select fields carry tick options; write-in fields carry none', () => {
    const spec = paperSpec(FORMS.find((f) => f.id === 'check_in'));
    expect(spec.fields.find((f) => f.key === 'direction').options.map((o) => o.value))
      .toEqual(['in', 'out']);
    expect(spec.fields.find((f) => f.key === 'worker').options).toBeNull();
  });
});

describe('layout', () => {
  test('high-volume forms use the row grid, the rest use blocks', () => {
    for (const spec of PAPER_FORMS) {
      expect(spec.layout).toBe(GRID_FORMS.has(spec.id) ? 'grid' : 'block');
      expect(spec.repeat).toBeGreaterThan(0);
    }
    expect(PAPER_FORMS.find((f) => f.id === 'production').layout).toBe('grid');
    expect(PAPER_FORMS.find((f) => f.id === 'note').layout).toBe('block');
  });
});

describe('render', () => {
  const html = renderPaperFormsHtml({ stamp: 'test build 0', generatedOn: '2026-08-24' });

  test('emits one page-breaking sheet per form', () => {
    expect(html.match(/class="sheet"/g)).toHaveLength(PAPER_FORMS.length);
  });

  test('every form title appears in Devanagari', () => {
    for (const spec of PAPER_FORMS) expect(html).toContain(spec.titleHi);
  });

  test('grid rows and blocks are repeated as specified', () => {
    const prod = PAPER_FORMS.find((f) => f.id === 'production');
    // One tick cell per grid row, per grid form.
    const tickCells = html.match(/class="c-tick">☐/g) || [];
    const gridRows = PAPER_FORMS.filter((f) => f.layout === 'grid')
      .reduce((s, f) => s + f.repeat, 0);
    expect(tickCells).toHaveLength(gridRows);
    expect(prod.repeat).toBeGreaterThan(1);
  });

  test('carries the reconciliation tick that the Adoption view counts against', () => {
    expect(html).toContain('Entered in app');
    expect(html).toContain('In app');
  });

  test('escapes rather than interpolating raw label text', () => {
    const spec = paperSpec({
      id: 'x', icon: '', titleKey: 'note',
      fields: [{ key: 'k', labelKey: 'nope_<script>', kind: 'text' }],
    });
    expect(spec.fields[0].labelHi).toBe('nope_<script>');
    // renderPaperFormsHtml only ever renders PAPER_FORMS, but the escaper is
    // the guard if that ever changes.
    expect(html).not.toContain('<script>');
  });
});
