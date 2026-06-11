/** @jest-environment jsdom */
import { resolveFirebaseEnv, getFirebaseConfig } from '../../src/shared/config/firebase.js';

describe('firebase config env resolution', () => {
  beforeEach(() => localStorage.clear());

  test('defaults to staging', () => {
    expect(resolveFirebaseEnv()).toBe('staging');
    expect(getFirebaseConfig().projectId).toBe('sep-dashboard-staging');
  });

  test('persisted env is honoured; unknown values fall back to default', () => {
    localStorage.setItem('sep_fb_env', 'prod');
    expect(resolveFirebaseEnv()).toBe('prod');
    localStorage.setItem('sep_fb_env', 'garbage');
    expect(resolveFirebaseEnv()).toBe('staging');
  });

  test('prod is an unprovisioned placeholder — callers must handle null', () => {
    expect(getFirebaseConfig('prod')).toBeNull();
  });
});
