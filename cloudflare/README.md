# YorpHives Headquarters — ₹0 Cloudflare Free pilot

**Status on November 15, 2026:** Isolated pilot Worker and dedicated D1 database created in the founder's Cloudflare account. One 5-minute Cron Trigger is enabled. A founder-only Cloudflare Access application protects the pilot hostname. The frontend is served by a self-contained module bundle generated from three allowlisted UI files. The existing live YorpHives Worker and the website repository were NOT edited.

## Pilot access

Private URL: https://yorphives-hq-free-pilot.solopreneursid-proy.workers.dev/

The Cloudflare Access policy permits the Cloudflare-account founder only. Worker code also validates Access JWTs cryptographically; it fails closed if Access configuration is missing. If the interface is inaccessible, **do not bypass authentication**—diagnose the Access policy and Worker bindings instead. HTTP responses and market signals are observations, not verification of tool functionality.

### Actual dedicated Cloudflare resources

| Resource | Value |
| --- | --- |
| Worker | `yorphives-hq-free-pilot` |
| D1 database | `yorphives-hq-free-intelligence` |
| D1 ID | `209422af-3d1d-470d-b204-f5f5f33a2afa` |
| Cron | `*/5 * * * *` (UTC) |
| Access app | `YorpHives Headquarters — Private Free Pilot` |
| Access domain | `yorphives-hq-free-pilot.solopreneursid-proy.workers.dev` |
| Existing production Worker | `yorphives-processing-api` — **untouched** |

No API keys, model credentials, website-write tokens or deployment privileges are bound to the monitoring Worker. The D1 database is separate from website data.

## What this deployed Worker does

- Every 5 minutes: public GET availability check of `https://yorphives.com/`.
- Every hour: GET availability checks on up to four least-recently-checked automatically enrolled tools.
- Every six hours: inspect the public sitemap, tool/free-tool/explore catalog links, and optional product JSON manifest. Insert newly found tool URLs into a dedicated D1 inventory.
- Daily: inspect a limited public Show HN RSS feed to identify **unvalidated** product-research leads.
- Store compact findings, status, links to evidence and internal daily request usage for private dashboard review.
- Report repeated failures; require founder approval for any proposed change.
- Restrict public request targets to the founder website and one fixed research feed.
- Cap public HTTP fetches to **900/day** using a D1 budget counter. If exhausted, checks stop rather than spend.
- Delete old research leads after 90 days to limit storage, retaining product inventory and incident evidence.

This is intentionally **passive monitoring and research**. There is no browser automation, code execution, GitHub writing, deployment, purchase, AI model inference, automatic repair or active penetration testing.

### Current limitations (must not be misrepresented)

- A sitemap or server-rendered catalog might omit SPA-only/unlinked tools. Missing routes cannot be inferred to be removed. A founder-approved product manifest is the preferred reliable coverage source.
- HTTP availability does **not** validate tool functionality or security.
- A public RSS product mention does **not** establish customer demand, organic traffic or revenue potential.
- Cloudflare Free Workers CPU time is small; extensive crawls, vulnerability scans, and full model inference are not appropriate.
- Competitor feature-gap checking, dependency vulnerability intelligence, verified revenue intelligence, and event-driven free AI analysis remain later modular adapters. The existing local Python research prototype is separate and not running on Cloudflare.
- An independent external outage monitor still requires an environment outside Cloudflare. The old isolated Python watchdog is not part of this Cloudflare deployment.
- A Cloudflare Account, D1 and Access are managed services: no immediate SaaS bill within Free quotas, but **not full self-hosting** or guaranteed indefinite free access.

## Zero-spend safeguards

1. Stay on Cloudflare **Workers Free**. Do not upgrade the plan, enable Containers, or add paid bindings.
2. The Worker declares only D1, static UI assets and Cloudflare Access configuration. **No `AI` or browser binding** exists.
3. Hard internal public-fetch budget: 900 requests/day. Only one Cron Trigger (5-minute interval), even though the Free plan permits more.
4. If Cloudflare quotas or database operations fail, tasks should report missing/stale evidence, never invent successful monitoring.
5. Security alerts are recommendations. No deployed worker can modify repositories, deploy changes, alter DNS or purchase anything.
6. The source follows portable JS + SQL interfaces; a future move to Node/SQLite can reuse the evidence format, although infrastructure migration still requires work.

## Repository source

| File | Purpose |
| --- | --- |
| `cloudflare/src/worker.mjs` | Event-driven, read-only Cloudflare Worker |
| `cloudflare/migrations/0001_initial.sql` | Five compact portable evidence tables |
| `cloudflare/wrangler.jsonc` | Isolated Worker/Free Cron/D1 configuration |
| `cloudflare/build-assets.mjs` | Strict three-file UI asset packaging |
| `cloudflare/build-standalone.mjs` | Zero-dependency bundled pilot file for authenticated API deployment |
| `cloudflare/tests/worker.test.mjs` | Node tests of quota-free architecture and guarded routes |
| `.github/workflows/cloudflare-free-tests.yml` | Read-only CI tests; **no automated deployment** |

Local, non-deploying verification after checking out this branch:

```bash
node --check cloudflare/src/worker.mjs
node --test cloudflare/tests/worker.test.mjs
node cloudflare/build-assets.mjs
node cloudflare/build-standalone.mjs
node --check cloudflare/.generated/standalone-worker.mjs
```

The standard Wrangler path uses `cloudflare/dist` (free Static Assets). The current private pilot uses the `standalone-worker.mjs` generated bundle so that only the three approved UI assets can be served through the authenticated Worker. A future migration to Static Assets will reduce Worker requests further and should retain the same Access gate. **Do not make Static Assets public while private evidence is in scope.**

### Manual review before expanding scope

Review the draft PR; confirm the Access login is founder-only; verify first D1 reports after scheduled checks; check website coverage and false positives; add the optional site product manifest only after a separate approval. Monitor Cloudflare's usage/billing dashboard to ensure zero payable usage.

Changes to source in GitHub are not automatically deployed to Cloudflare. Releasing a new bundle must be an explicitly founder-controlled development action. Workers themselves have no repository write/deploy permissions.
