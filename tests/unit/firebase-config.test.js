/** @jest-environment jsdom */
import { resolveFirebaseEnv, getFirebaseConfig } from '../../src/shared/config/firebase.js';

describe('firebase config env resolution', () => {
  beforeEach(() => localStorage.clear());

  test('defaults to staging', () => {
    expect(resolveFirebaseEnv()).toBe('staging');
    expect(getFirebaseConfig().projectId).toBe('sep-dashboard-staging');
  });

  test('unprovisioned or unknown persisted env falls back to default', () => {
    // 'prod' has no config yet — honouring it would pin the device to a null
    // config and silently disable sync; resolution falls back to staging
    // until prod is provisioned.
    localStorage.setItem('sep_fb_env', 'prod');
    expect(resolveFirebaseEnv()).toBe('staging');
    localStorage.setItem('sep_fb_env', 'garbage');
    expect(resolveFirebaseEnv()).toBe('staging');
  });

  test('prod is an unprovisioned placeholder — callers must handle null', () => {
    expect(getFirebaseConfig('prod')).toBeNull();
  });
});
