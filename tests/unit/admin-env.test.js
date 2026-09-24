import {
  FB_ENVS, PROJECT_IDS, credentialVarFor, projectFor,
} from '../../scripts/lib/admin.mjs';

// The admin plane targets one project per environment. The property that
// matters is NOT that prod works today (the project does not exist yet) — it
// is that staging and prod can never be confused for one another, because a
// deploy that silently fell back to the wrong project would report success
// against a database nobody meant to touch.
describe('admin environment resolution', () => {
  test('exactly two environments, staging first as the default', () => {
    expect(FB_ENVS).toEqual(['staging', 'prod']);
  });

  test('each environment names its OWN credential variable', () => {
    expect(credentialVarFor('staging')).toBe('FIREBASE_SERVICE_ACCOUNT_STAGING');
    expect(credentialVarFor('prod')).toBe('FIREBASE_SERVICE_ACCOUNT_PROD');
    expect(credentialVarFor('staging')).not.toBe(credentialVarFor('prod'));
  });

  test('each environment names its OWN project id', () => {
    expect(PROJECT_IDS.staging).toBe('sep-dashboard-staging');
    expect(PROJECT_IDS.prod).toBe('sep-dashboard-prod');
    const ids = FB_ENVS.map((e) => PROJECT_IDS[e]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every environment has both a credential var and a project id', () => {
    for (const e of FB_ENVS) {
      expect(PROJECT_IDS[e]).toBeTruthy();
      expect(credentialVarFor(e)).toMatch(/^FIREBASE_SERVICE_ACCOUNT_[A-Z]+$/);
    }
  });

  test('projectFor falls back to the environment default when --project is absent', () => {
    // No --project in the jest argv, so this exercises the default path.
    expect(projectFor('staging')).toBe('sep-dashboard-staging');
    expect(projectFor('prod')).toBe('sep-dashboard-prod');
  });
});
