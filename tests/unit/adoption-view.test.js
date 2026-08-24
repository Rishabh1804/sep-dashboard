/**
 * @jest-environment jsdom
 */
import {
  initAdoption, renderAdoption, adSetPaper, adShiftWeek, adThisWeek, adoptionNeedsLoad,
  loadAdoption,
} from '../../src/dashboard/adoption-view.js';
import { ADOPTION_FORMS, isoWeekStart, isoWeekKey, PAPER_STORE_KEY } from '../../src/dashboard/adoption-model.js';

// No Firebase in jsdom: the session getter returns null, so loadAdoption()
// is a no-op and the view renders its un-run state. That is exactly the state
// a steward sees before pressing Refresh, so it is worth pinning.
let paints = 0;
beforeEach(() => {
  localStorage.clear();
  paints = 0;
  initAdoption(() => { paints += 1; }, () => null);
});

const steward = { is_steward: true };
const admin = { is_admin: true };

describe('access', () => {
  test('steward-exclusive: a viewer session is told so, not shown an empty grid', () => {
    const html = renderAdoption({});
    expect(html).toContain('Steward-exclusive');
    expect(html).not.toContain('ad-table');
  });

  test('admin and steward both get the grid', () => {
    for (const claims of [steward, admin]) {
      expect(renderAdoption(claims)).toContain('ad-table');
    }
  });
});

describe('grid', () => {
  test('one row per handler form, seven day columns each', () => {
    const html = renderAdoption(steward);
    for (const f of ADOPTION_FORMS) expect(html).toContain(f.label);
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) expect(html).toContain(`<th>${d}</th>`);
    // 9 forms × 7 days = 63 paper inputs.
    expect(html.match(/class="ad-paper"/g)).toHaveLength(ADOPTION_FORMS.length * 7);
  });

  test('the Week rate column sits before the days, so it never scrolls away', () => {
    const html = renderAdoption(steward);
    const head = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
    expect(head.indexOf('Week')).toBeLessThan(head.indexOf('>Mon<'));
  });

  test('paper inputs carry the form + day the handler writes back to', () => {
    const html = renderAdoption(steward);
    expect(html).toContain('data-form="production" data-day="0"');
    expect(html).toContain('data-form="note" data-day="6"');
  });

  test('opens on the current ISO week and cannot page into the future', () => {
    const html = renderAdoption(steward);
    expect(html).toContain(isoWeekKey(isoWeekStart()));
    expect(html).toMatch(/onclick="adShiftWeek\(1\)"\s+disabled/);
  });
});

describe('honest states', () => {
  test('an un-run week shows — not 0%, and says to press Refresh', () => {
    const html = renderAdoption(steward);
    expect(html).toContain('Not counted yet');
    expect(html).toContain('>—<');
    expect(html).not.toContain('>0%<');
  });

  // The defect this pins: with paper counts entered but no fetch run,
  // rate(0, 206) is a legitimate 0 — and rendering it puts a red 0% against a
  // week nobody has counted. Digital is UNKNOWN before a fetch, not zero.
  test('paper counts alone never produce a 0% rate before a count has run', () => {
    adSetPaper({ dataset: { form: 'production', day: '0' }, value: '42' });
    const html = renderAdoption(steward);
    expect(html).not.toContain('0%');
    expect(html).toContain('not counted yet');
    expect(html).toContain('ad-head ');          // no status colour class
    expect(html).not.toMatch(/ad-head ad-(below|ok|near|over)/);
  });

  test('states that paper counts live on this device only', () => {
    expect(renderAdoption(steward)).toContain('THIS device only');
  });
});

describe('paper entry round-trip', () => {
  const el = (form, day, value) => ({ dataset: { form, day: String(day) }, value });

  test('a typed count persists, repaints, and shows up as a rate', () => {
    adSetPaper(el('production', 0, '10'));
    expect(paints).toBe(1);
    const html = renderAdoption(steward);
    expect(html).toContain('value="10"');
    // Digital stays unknown until a fetch runs, so the week cell reads —/10.
    expect(html).toContain('—/10');
  });

  test('writes through to localStorage under the week key', () => {
    adSetPaper(el('dft', 3, '7'));
    const raw = JSON.parse(localStorage.getItem(PAPER_STORE_KEY));
    expect(raw[isoWeekKey(isoWeekStart())].dft[3]).toBe(7);
  });

  test('counts are per week — paging back shows an empty week, not the current one', () => {
    adSetPaper(el('production', 0, '10'));
    expect(renderAdoption(steward)).toContain('value="10"');
    adShiftWeek(-1);
    expect(renderAdoption(steward)).not.toContain('value="10"');
    adThisWeek();
    expect(renderAdoption(steward)).toContain('value="10"');
  });

  test('an invalid entry is refused without corrupting the stored week', () => {
    adSetPaper(el('production', 0, '10'));
    adSetPaper(el('production', 0, '-5'));
    expect(renderAdoption(steward)).toContain('value="10"');
  });
});

describe('load gating', () => {
  test('a week change with no session drops back to un-counted, never stale', async () => {
    // The session goes away mid-view (token expiry / sign-out) and the steward
    // then pages to another week. Without the reset, the PREVIOUS week's docs
    // would be re-bucketed into the new week behind a stale 'ready' flag and
    // render as a measurement.
    let live = fakeSession({
      production_entries: [{ author_user_id: 'champai', client_ts: Date.now() }],
    });
    initAdoption(() => {}, () => live);
    await loadAdoption();
    expect(renderAdoption(steward)).not.toContain('Not counted yet');

    live = null;
    await loadAdoption();
    expect(renderAdoption(steward)).toContain('Not counted yet');
  });

  test('reports that it still needs a load, so the tab fetches on first open', () => {
    expect(adoptionNeedsLoad()).toBe(true);
  });
});

// A stub Firestore: enough of the modular SDK surface for loadAdoption to run,
// so the fetch → count → render path is exercised without a network.
function fakeSession(docsByColl = {}) {
  const fs = {
    Timestamp: { fromMillis: (ms) => ({ ms }) },
    collection: (_db, name) => ({ name }),
    collectionGroup: (_db, name) => ({ name }),
    where: () => ({}),
    limit: () => ({}),
    query: (src) => src,
    getDocs: async (src) => ({
      docs: (docsByColl[src.name] || []).map((d) => ({ id: d.id || 'x', data: () => d })),
    }),
  };
  return { db: {}, fs };
}

describe('after a count has run', () => {
  const nowInWeek = () => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d.getTime();
  };

  test('an empty result is a measured zero, and asks for the paper denominator', async () => {
    initAdoption(() => {}, () => fakeSession());
    await loadAdoption();
    const html = renderAdoption(steward);
    expect(html).toContain('No paper counts entered yet');
    expect(html).not.toContain('Not counted yet');
    // digital is now known to be zero — it renders as 0, not as —
    expect(html).toContain('ad-zero">0<');
  });

  test('counts person-authored docs and reports a real rate', async () => {
    initAdoption(() => {}, () => fakeSession({
      production_entries: [
        { author_user_id: 'champai', client_ts: nowInWeek() },
        { author_user_id: 'champai', client_ts: nowInWeek() },
        { author_user_id: 'system:import', client_ts: nowInWeek() },
      ],
    }));
    await loadAdoption();
    adSetPaper({ dataset: { form: 'production', day: String((new Date().getDay() + 6) % 7) }, value: '4' });
    const html = renderAdoption(steward);
    expect(html).toContain('50%');      // 2 person-authored of 4 on paper
    expect(html).toContain('2/4');
  });

  test('a permission-denied collection is reported as missing, not as zero', async () => {
    const fs = fakeSession().fs;
    fs.getDocs = async (src) => {
      if (src.name === 'shifts') { const e = new Error('nope'); e.code = 'permission-denied'; throw e; }
      return { docs: [] };
    };
    initAdoption(() => {}, () => ({ db: {}, fs }));
    await loadAdoption();
    const html = renderAdoption(steward);
    expect(html).toContain('denied');
    expect(html).toContain('MISSING measurement, not a zero');
  });
});
