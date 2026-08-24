#!/usr/bin/env node
// Deploy Cloud Functions to a live project with service-account credentials.
// Mirrors deploy-rules.mjs (shared credential plumbing in scripts/lib/admin.mjs;
// pinned firebase-tools). firebase.json's predeploy vendors the shared pure
// logic first, so the deployed bundle always carries a fresh copy of cross-doc.js.
//
// ════════════════════════════════════════════════════════════════════════════
// FIRST-DEPLOY RUNBOOK (one-time per PROJECT — verified end-to-end on staging,
// 16 Jun 2026). v2 Firestore-trigger functions need ALL of the below before the
// deploy succeeds. Each step gated the staging deploy in this exact order; do
// them up front for prod so its first deploy is a one-shot, not a rediscovery.
// As project OWNER (e.g. in Cloud Shell), for project <P>:
//
// 1. BILLING — link a Blaze (pay-as-you-go) billing account to <P>. Functions
//    cannot deploy on the Spark free plan. (Firestore/rules/Auth can — that's
//    why deploy-rules + the seed worked on Spark.) At this scale, min-instances=0
//    keeps it within the free tier (~₹0/mo). Firebase console → Usage → Modify
//    plan → Blaze; set a budget alert.
//
// 2. ENABLE APIs:
//      gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com \
//        artifactregistry.googleapis.com eventarc.googleapis.com run.googleapis.com \
//        pubsub.googleapis.com cloudbilling.googleapis.com --project <P>
//    (cloudbilling is the one firebase-tools queries to verify Blaze — easy to miss.)
//
// 3. DEPLOY-SA ROLES — deploy-rules' grant (Firebase Rules Admin + Service Usage
//    Consumer) is NOT enough. On the deploy SA (the FIREBASE_SERVICE_ACCOUNT_*
//    identity's client_email):
//      for r in roles/cloudfunctions.admin roles/iam.serviceAccountUser \
//               roles/cloudbuild.builds.editor roles/artifactregistry.writer \
//               roles/eventarc.admin roles/run.admin; do
//        gcloud projects add-iam-policy-binding <P> \
//          --member=serviceAccount:<deploy-sa-email> --role=$r; done
//
// 4. SERVICE-AGENT BINDINGS — Google-managed service agents (NOT the deploy SA);
//    firebase-tools prints these verbatim if missing. With <N> = project number:
//      gcloud projects add-iam-policy-binding <P> \
//        --member=serviceAccount:service-<N>@gcp-sa-pubsub.iam.gserviceaccount.com \
//        --role=roles/iam.serviceAccountTokenCreator
//      gcloud projects add-iam-policy-binding <P> \
//        --member=serviceAccount:<N>-compute@developer.gserviceaccount.com \
//        --role=roles/run.invoker
//      gcloud projects add-iam-policy-binding <P> \
//        --member=serviceAccount:<N>-compute@developer.gserviceaccount.com \
//        --role=roles/eventarc.eventReceiver
//
// 5. FIRST-DEPLOY EVENTARC PROPAGATION — the very first v2 deploy can fail every
//    function create with "Permission denied while using the Eventarc Service
//    Agent … retry in a few minutes." This is benign auto-provisioning lag, NOT
//    a config error: wait ~3-5 min and re-run. The deploy is idempotent.
//
// Until 1-4 are in place each surfaces as a clean 403/400 here (by design — at
// the deploy, not on the floor). Prod also sets AGG_MIN_INSTANCES=1 per
// CONFLICT_RESOLUTION.md (always-warm aggregators).
// ════════════════════════════════════════════════════════════════════════════
//
// Usage: node scripts/deploy-functions.mjs [--env staging|prod] [--project <id>]
//   --env picks the credential secret AND the default project id; --project
//   still overrides the id explicitly. Defaults to staging.


import { spawnSync } from 'node:child_process';
import { env, exit } from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withCredentialFile, resolveEnv, projectFor } from './lib/admin.mjs';

const FIREBASE_TOOLS = 'firebase-tools@15.19.1'; // keep in lockstep with CI
const fbEnv = resolveEnv();
const project = projectFor(fbEnv);

// firebase-tools introspects functions/src in-process to enumerate the triggers
// it must deploy, so functions/ deps have to be installed locally FIRST. The
// root `pnpm install` doesn't touch functions/ (it's a separate package), so
// install it here off the committed lockfile. (Cloud Build re-installs for the
// runtime; this is only for the local analysis pass.)
const functionsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'functions');
const install = spawnSync('npm', ['ci'], { stdio: 'inherit', cwd: functionsDir, env });
if (install.status !== 0) exit(install.status ?? 1);

const status = withCredentialFile((credPath) => {
  const r = spawnSync('npx',
    ['-y', FIREBASE_TOOLS, 'deploy', '--only', 'functions', '--project', project, '--non-interactive', '--force'],
    { stdio: 'inherit', env: { ...env, GOOGLE_APPLICATION_CREDENTIALS: credPath } });
  return r.status ?? 1;
}, fbEnv);
exit(status);
