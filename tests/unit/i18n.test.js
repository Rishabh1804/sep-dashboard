import { DICT, LANGS, t, getLang, setLang } from '../../src/handler/i18n.js';

describe('handler i18n dictionary', () => {
  test('every key carries both Hindi and English (no missing translations)', () => {
    const missing = [];
    for (const [key, entry] of Object.entries(DICT)) {
      for (const lang of LANGS) {
        if (!entry[lang] || typeof entry[lang] !== 'string') missing.push(`${key}.${lang}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('LANGS is hi-primary, en-secondary', () => {
    expect(LANGS).toEqual(['hi', 'en']);
  });
});

describe('t() lookup', () => {
  test('returns the requested language', () => {
    expect(t('saved', 'en')).toBe('Saved');
    expect(t('saved', 'hi')).toBe('सेव हो गया');
  });

  test('falls back to the raw key when unknown', () => {
    expect(t('___nope___', 'en')).toBe('___nope___');
  });

  test('defaults to the current language when none passed', () => {
    setLang('en');
    expect(t('back')).toBe('Back');
    setLang('hi');
    expect(t('back')).toBe('वापस');
  });
});

describe('setLang()', () => {
  test('accepts valid languages and persists', () => {
    expect(setLang('en')).toBe('en');
    expect(getLang()).toBe('en');
  });

  test('rejects invalid languages, keeping the current one', () => {
    setLang('hi');
    expect(setLang('fr')).toBe('hi');
    expect(getLang()).toBe('hi');
  });
});
