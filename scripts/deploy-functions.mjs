#!/usr/bin/env node
// Deploy Cloud Functions to a live project with service-account credentials.
// Mirrors deploy-rules.mjs (shared credential plumbing in scripts/lib/admin.mjs;
// pinned firebase-tools). firebase.json's predeploy vendors the shared pure
// logic first, so the deployed bundle always carries a fresh copy of cross-doc.js.
//
// ⚠ IAM — the gated part (this is why the prompt says check the deploy path
// FIRST). deploy-rules' grant on the staging service account (Firebase Rules
// Admin + Service Usage Consumer) is NOT enough for functions. A v2 functions
// deploy additionally needs, on the staging SA:
//   - roles/cloudfunctions.admin        (Cloud Functions Admin)
//   - roles/iam.serviceAccountUser      (act as the functions runtime SA)
//   - roles/cloudbuild.builds.editor    (v2 builds a container via Cloud Build)
//   - roles/artifactregistry.writer     (push that container image)
//   - roles/eventarc.admin              (Firestore-trigger plumbing)
//   - roles/run.admin                   (v2 functions run on Cloud Run)
// plus these APIs enabled on the project: cloudfunctions, cloudbuild,
// artifactregistry, eventarc, run, pubsub. Until granted, this dead-ends at a
// 403 the same way deploy-rules did — by design we surface that here, not at
// the floor.
//
// Usage: node scripts/deploy-functions.mjs [--project sep-dashboard-staging]

import { spawnSync } from 'node:child_process';
import { argv, env, exit } from 'node:process';
import { withCredentialFile } from './lib/admin.mjs';

const FIREBASE_TOOLS = 'firebase-tools@15.19.1'; // keep in lockstep with CI
const i = argv.indexOf('--project');
const project = i > -1 ? argv[i + 1] : 'sep-dashboard-staging';

const status = withCredentialFile((credPath) => {
  const r = spawnSync('npx',
    ['-y', FIREBASE_TOOLS, 'deploy', '--only', 'functions', '--project', project, '--non-interactive', '--force'],
    { stdio: 'inherit', env: { ...env, GOOGLE_APPLICATION_CREDENTIALS: credPath } });
  return r.status ?? 1;
});
exit(status);
