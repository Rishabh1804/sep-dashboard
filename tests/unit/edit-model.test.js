import {
  buildEditPayload, docTypeFromPath, editableFields, isEditable,
  summarizeRevision, REASON_ENUM, FIELD_SPECS,
} from '../../src/dashboard/edit-model.js';

describe('docTypeFromPath()', () => {
  test('top-level doc keys on the collection', () => {
    expect(docTypeFromPath('production_entries/p1')).toBe('production_entries');
    expect(docTypeFromPath('jobs/sep-42')).toBe('jobs');
  });
  test('subcollection doc keys on the subcollection name', () => {
    expect(docTypeFromPath('stock_items/zinc/depletions/d1')).toBe('depletions');
    expect(docTypeFromPath('workers/u-champai/shifts/s1')).toBe('shifts');
  });
  test('empty / garbage path → empty string', () => {
    expect(docTypeFromPath('')).toBe('');
    expect(docTypeFromPath(null)).toBe('');
  });
});

describe('editable surface', () => {
  test('every spec field has a key + kind, and selects carry options', () => {
    for (const [, fields] of Object.entries(FIELD_SPECS)) {
      for (const f of fields) {
        expect(typeof f.key).toBe('string');
        expect(['number', 'text', 'select']).toContain(f.kind);
        if (f.kind === 'select') expect(Array.isArray(f.options)).toBe(true);
      }
    }
  });
  test('stock receipts are deliberately NOT editable (no collection-group read path)', () => {
    expect(editableFields('receipts')).toBeNull();
    expect(isEditable('stock_items/zinc/receipts/r1')).toBe(false);
  });
  test('the rules-editable collections are all present', () => {
    for (const t of ['production_entries', 'dft_measurements', 'jobs', 'dispatch_events', 'notes', 'shifts', 'depletions']) {
      expect(editableFields(t)).not.toBeNull();
    }
  });
});

const UID = 'u-rishabh';

describe('buildEditPayload — validation', () => {
  test('rejects an un-editable type', () => {
    const r = buildEditPayload({ path: 'audit_events/a1', before: {}, values: {}, reason: 'typo', uid: UID });
    expect(r.ok).toBe(false);
  });
  test('rejects when not signed in', () => {
    const r = buildEditPayload({ path: 'jobs/j1', before: { current_status: 'in-flight' }, values: { current_status: 'ready' }, reason: 'late-correction' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/signed in/);
  });
  test('rejects a missing / unknown reason', () => {
    const r = buildEditPayload({ path: 'jobs/j1', before: { current_status: 'in-flight' }, values: { current_status: 'ready' }, reason: '', uid: UID });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/reason/);
  });
  test('reason "other" requires free text', () => {
    const r = buildEditPayload({ path: 'jobs/j1', before: { current_status: 'in-flight' }, values: { current_status: 'ready' }, reason: 'other', reasonText: '  ', uid: UID });
    expect(r.ok).toBe(false);
  });
  test('rejects a no-op edit (nothing changed)', () => {
    const r = buildEditPayload({ path: 'jobs/j1', before: { current_status: 'ready' }, values: { current_status: 'ready' }, reason: 'typo', uid: UID });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no changes/);
  });
  test('blank field value is a no-change, not a clear', () => {
    const r = buildEditPayload({ path: 'production_entries/p1', before: { qty_pcs: 100 }, values: { qty_pcs: '' }, reason: 'typo', uid: UID });
    expect(r.ok).toBe(false);
  });
});

describe('buildEditPayload — success', () => {
  test('numeric edit captures before/after + revision', () => {
    const r = buildEditPayload({
      path: 'production_entries/p1',
      before: { qty_pcs: 100, author_user_id: 'u-champai' },
      values: { qty_pcs: '120', qty_kg: '', notes: '' },
      reason: 'operator-misread', uid: UID, now: 1765000000000,
    });
    expect(r.ok).toBe(true);
    expect(r.type).toBe('production_entries');
    expect(r.changedKeys).toEqual(['qty_pcs']);
    expect(r.updates.qty_pcs).toBe(120);
    expect(r.updates.last_edit_reason).toBe('operator-misread');
    expect(r.updates.last_edited_by).toBe(UID);
    expect(r.revision).toEqual({
      at: 1765000000000, by: UID, reason: 'operator-misread',
      before: { qty_pcs: 100 }, after: { qty_pcs: 120 },
    });
  });

  test('number comparison is type-correct ("100" string-before vs 100 stays no-change)', () => {
    const r = buildEditPayload({
      path: 'production_entries/p1', before: { qty_pcs: 100 },
      values: { qty_pcs: '100' }, reason: 'typo', uid: UID,
    });
    expect(r.ok).toBe(false);   // 100 === Number('100')
  });

  test('select edit (job status flip) + evidence threads into updates and revision', () => {
    const r = buildEditPayload({
      path: 'jobs/sep-42',
      before: { current_status: 'in-flight', route: 'standard' },
      values: { current_status: 'dispatched', route: 'standard' },
      reason: 'late-correction', evidence: 'note:N-1042', uid: UID,
    });
    expect(r.ok).toBe(true);
    expect(r.changedKeys).toEqual(['current_status']);
    expect(r.updates.current_status).toBe('dispatched');
    expect(r.updates.last_edit_evidence).toBe('note:N-1042');
    expect(r.revision.evidence).toBe('note:N-1042');
  });

  test('reason "other" threads the free text into both updates and revision', () => {
    const r = buildEditPayload({
      path: 'notes/n1', before: { summary: 'old' },
      values: { summary: 'new' }, reason: 'other', reasonText: 'merged duplicate', uid: UID,
    });
    expect(r.ok).toBe(true);
    expect(r.updates.last_edit_reason_text).toBe('merged duplicate');
    expect(r.revision.reason_text).toBe('merged duplicate');
  });

  test('multiple fields change in one edit', () => {
    const r = buildEditPayload({
      path: 'dft_measurements/m1',
      before: { micron_value: 7, outcome: 'fail-rework' },
      values: { micron_value: '10', outcome: 'pass' },
      reason: 'equipment-misread', uid: UID,
    });
    expect(r.ok).toBe(true);
    expect(new Set(r.changedKeys)).toEqual(new Set(['micron_value', 'outcome']));
    expect(r.updates.micron_value).toBe(10);
    expect(r.updates.outcome).toBe('pass');
  });
});

describe('summarizeRevision()', () => {
  test('renders changed fields + reason', () => {
    const s = summarizeRevision({ at: 1, by: UID, reason: 'typo', before: { qty_pcs: 100 }, after: { qty_pcs: 120 } });
    expect(s).toContain('qty_pcs: 100 → 120');
    expect(s).toContain('typo');
  });
  test('null/empty before renders ∅', () => {
    const s = summarizeRevision({ reason: 'late-correction', before: { notes: null }, after: { notes: 'x' } });
    expect(s).toContain('∅ → x');
  });
  test('reason "other" surfaces its free text', () => {
    const s = summarizeRevision({ reason: 'other', reason_text: 'merged', before: { summary: 'a' }, after: { summary: 'b' } });
    expect(s).toContain('other — merged');
  });
  test('empty revision → empty string', () => {
    expect(summarizeRevision(null)).toBe('');
  });
});

describe('REASON_ENUM', () => {
  test('carries the locked steward enum (STEWARD_AFFORDANCES §edit-with-reason)', () => {
    expect(REASON_ENUM.map((r) => r.value)).toEqual(
      ['typo', 'operator-misread', 'equipment-misread', 'customer-disputed', 'late-correction', 'other']);
  });
});
