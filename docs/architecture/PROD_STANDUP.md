# Production project stand-up

**Status:** not started — `sep-dashboard-prod` does not exist.
**Prerequisite for:** running the Week-1 rollout on production data.
**Applies:** the staging runbook, second time. Nothing here is new engineering.

---

## Read this first: the decision, not the steps

Everything shipped to date runs against **`sep-dashboard-staging`**, including
the real 508-challan seed (2,494 docs, 12 Jun). The Week-0 rollout runbook
([`WEEK_0_RUNBOOK.md`](WEEK_0_RUNBOOK.md)) points at staging too.

So there is a fork to settle **before Week 1 opens**, not after:

| Option | Consequence |
|---|---|
| **Stand prod up first, roll out onto it** | Clean. Week 1 data is production data from entry one. Costs the stand-up (below) up front, and re-seeds the 508 challans into prod. |
| **Roll out on staging, migrate later** | Faster to start. But the floor's first weeks of real production entries then live in a project named "staging", and moving them is an export/import with idempotency-key collisions to reason about. |
| **Roll out on staging, keep it** | Honest if staging is simply renamed in everyone's head — but the name will outlive the intention, and `min_supported_build` / rules experiments have been run against it freely on the assumption that it is disposable. |

The first option is the one this document is written for. The cost is
concentrated and one-time; the others defer it into the middle of a rollout.

---

## What is already in place

The engineering is done. Prod needs no code:

- **Admin plane is env-switched.** `scripts/lib/admin.mjs` resolves
  `--env staging|prod` (or `SEP_FB_ENV`) to `FIREBASE_SERVICE_ACCOUNT_<ENV>`
  and to the project id. The `firebase-admin` workflow takes an `env` input.
  A prod run with only the staging secret present **fails at the credential
  check** — it never falls back to staging.
- **npm scripts:** `deploy:rules:prod`, `deploy:functions:prod`.
- **Client env switch:** `src/shared/config/firebase.js` already carries a
  `prod` slot (currently `null`) and `?fbenv=prod` persists the choice —
  but only for a *provisioned* env, so pointing a device at prod before the
  config exists cannot silently disable its sync.
- **The GCP first-deploy runbook** — billing, six APIs, six deploy-SA roles,
  three service-agent bindings, the Eventarc propagation retry — is documented
  step-by-step in the header of `scripts/deploy-functions.mjs`, verified
  end-to-end on staging (16 Jun). **Follow it there; it is not duplicated here.**

> ⚠️ The env switch is **backward-compatible by construction** (staging is the
> default and its behaviour is byte-identical) but the prod path is
> **unexercised** — there is no prod project to exercise it against. Expect the
> first prod run to surface something; that is what the dry runs below are for.

---

## Stand-up sequence

Steps 1–3 and 5 are Firebase/GCP console + `gcloud` work that only a project
owner can do. They are not automatable from this repo.

### 1. Create the project

- Firebase console → Add project → **`sep-dashboard-prod`**.
- Firestore → Create database → **Native mode**, region **`asia-south1`**
  (same as staging; region is immutable after creation).
- **Production mode** rules to start (default-deny), same as staging.
- Authentication → Get started (custom-token sign-in needs the service enabled).

### 2. Billing

Link a **Blaze** billing account. Cloud Functions cannot deploy on Spark.
Set a budget alert. At this scale with `min-instances=0` the cost is
effectively nil — but note `CONFLICT_RESOLUTION.md` calls for
`AGG_MIN_INSTANCES=1` in prod (always-warm aggregators), which is not free.
Decide that consciously.

### 3. Service account + repo secret

- Create a deploy service account; download its JSON key.
- Grant it the roles listed in the `deploy-functions.mjs` header (**both**
  sets: the rules pair and the six functions roles) plus the three
  service-agent bindings.
- GitHub → Settings → Secrets and variables → Actions → new secret
  **`FIREBASE_SERVICE_ACCOUNT_PROD`**, the full JSON.

> The staging service account still lacks *Firebase Rules Admin* +
> *Service Usage Consumer*, which is why `deploy-rules` has returned 403 since
> 12 June. **Grant those on the prod SA at creation time** so prod never
> inherits that gap — and fix staging in the same sitting.

### 4. Web app config → `firebase.js`

Firebase console → Project settings → Your apps → Add web app. Copy the config
object into the `prod` slot of `src/shared/config/firebase.js`, replacing
`null`. These are public identifiers; security is the rules plus App Check,
never secrecy (the file says so already).

### 5. Deploy, seed, verify — in this order

Each step is a `firebase-admin` workflow run with **`env: prod`**, or the
equivalent npm script locally.

| # | Action | Acceptance |
|---|---|---|
| 1 | `deploy-rules` | `✔ Deploy complete` — no 403 |
| 2 | `seed-dry-run` | transform + Zod validation clean, collision count reported |
| 3 | `seed-fixture` | synthetic fixture lands; `config/min_supported_build` created |
| 4 | `deploy-functions` | all functions registered (expect the Eventarc retry on the **first** deploy — benign, re-run) |
| 5 | `verify-e2e` | self-mint → sign-in → transport write accepted → read-back → replay denied and resolved |
| 6 | `verify-aggregator` | a `dispatch_event` flips its job to `dispatched`, then auto-cleans |
| 7 | Real seed | run from **soma-internal**'s `seed-staging` workflow against prod — the FY27 export lives in that private repo and must never enter this one. **Dry run first**: the 12-Jun dry run is what caught 107 challan collisions. |
| 8 | `mint-token` | provision handlers against prod; **re-provision every device** — a staging token is not a prod token |

### 6. Point the clients at prod

- Open the dashboard and the handler PWA once each with `?fbenv=prod`; the
  choice persists to localStorage per device.
- Confirm the handler's sync chip goes green and pickers hydrate **from the
  prod seed**, not a stale IndexedDB cache from staging.
- ⚠️ **Queued offline entries are not migrated.** Any record sitting unsent in
  a device's queue was addressed to staging. Flush every device to green
  *before* switching it, or those entries land in the wrong project.

---

## Acceptance

- [ ] `sep-dashboard-prod` exists, Firestore in `asia-south1`, Auth enabled
- [ ] Blaze linked, budget alert set, `AGG_MIN_INSTANCES` decided
- [ ] `FIREBASE_SERVICE_ACCOUNT_PROD` secret set; SA carries rules **and**
      functions roles
- [ ] `prod` config filled in `src/shared/config/firebase.js`
- [ ] Steps 1–6 of §5 green
- [ ] Real FY27 seed loaded from soma-internal, counts reconciled
- [ ] Every handler device re-provisioned and flushed green before the switch
- [ ] `WEEK_0_RUNBOOK.md` re-read with prod as the target
