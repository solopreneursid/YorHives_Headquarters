# YorpHives Headquarters — ₹0 Cloudflare Free pilot

**Status on November 15, 2026:** Isolated pilot Worker and dedicated D1 database created in the founder's Cloudflare account. One 5-minute Cron Trigger is enabled. A founder-only Cloudflare Access application protects the pilot hostname. The frontend is served by a self-contained module bundle generated from three allowlisted UI files. The existing live YorpHives Worker and the website repository were NOT edited.

## Authentication repair — verified 2026-11-15

The private `workers.dev` pilot initially displayed a bare Worker `403` before the founder could sign in. The Access application had been configured as a public hostname destination, but it was not intercepting requests to the private Worker.

**Fix applied only to the Headquarters pilot:** moved the existing founder-only Cloudflare Access application from a hostname destination to a direct **Worker-level Access destination** using the Worker's immutable `tag` ID. The same existing Access application and audience were preserved, so the Worker's RS256 JWT verification remains configured. No DNS changes, existing website Worker changes, billing upgrades, browser automation, or public bypass.

Verification: [Cloudflare Free authentication test run](https://github.com/solopreneursid/YorHives_Headquarters/actions/runs/43663900404) passed. A credential-free request from an independent GitHub runner received **HTTP 302 redirect to Cloudflare Access sign-in** rather than a raw Worker `403` or the private UI. The Access account has a one-time PIN identity provider available.

This proves the **anonymous authentication gate**, not the complete interactive login. The founder still needs to complete sign-in and confirm that the dashboard and private D1 report load after authentication. If sign-in succeeds but the Worker still returns `403`, inspect the JWT signature/issuer/audience verification without disabling the authentication gate.

## Founder-only login: second repair — 2026-11-15

A real founder browser visit still displayed `Private Headquarters access not configured or unauthorized` **after** the Worker-level Cloudflare Access redirect had been independently tested. That means the **unauthenticated redirect test was not enough to confirm successful login**.

Cloudflare's current Worker Access integration exposes a platform-verified signed-in user as `ctx.access` (with `ctx.access.aud` and `ctx.access.getIdentity()`). The earlier Worker code expected a legacy `Cf-Access-Jwt-Assertion` request header on every browser visit and rejected the request if that header wasn't present, even after Cloudflare Access had already authenticated the browser.

**Repair now deployed to the isolated pilot:** 
- First prefer Cloudflare's **verified** `ctx.access` identity and require the exact application audience **and** exact single founder email.
- If `ctx.access` is unavailable, accept only a cryptographically verified Access JWT with matching issuer, audience, expiration **and** founder email. Caller-supplied email headers are never trusted.
- The allowed founder email is a Cloudflare Worker binding `ACCESS_OWNER_EMAIL`, derived from the existing *one-email* Access allow policy, **not embedded in public source files**.
- If either identity or application doesn't match, fail closed with HTTP 403; do not expose dashboard data or provide authentication bypasses.
- No changes to the live YorpHives website, original Worker, schedules, billing tier, DNS or project permissions.

**Verification:** [Cloudflare Free access security regression](https://github.com/solopreneursid/YorHives_Headquarters/actions/runs/43664315615) and [Headquarters regression](https://github.com/solopreneursid/YorHives_Headquarters/actions/runs/43664315624) passed. Unit tests cover founder identity, wrong email, wrong audience, no identity, thrown identity lookups and forged headers. Cloudflare reports one allowed founder address, matching Access audience, the `ACCESS_OWNER_EMAIL` binding and one five-minute Cron. **A successful browser sign-in still requires confirmation from the founder**; no one-time access code or account session was collected.

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

## First verified growth-collector observation

At `2026-11-15T01:25:46.440Z`, the live Worker reported `research = sources:2/2:new:2`. Two mentions were stored in D1, bringing the internal public-fetch counter to **13 requests** for the day. A content review identified that these first mentions were not strong product leads, so the source filter was tightened and the **empty-catalog classification** was corrected. Earlier mentions remain traceable but are not claims of missing products.

This verifies execution and storage of public research **only**. It does not validate any user's market need or identify a profitable product.

## First verified live monitoring evidence

A real scheduled invocation completed and wrote these records to the dedicated D1 database on **2026-11-15**:

- Asset: `https://yorphives.com/`
- Observed HTTP status: **200 OK**
- Observation timestamp: `2026-11-15T01:05:44.889Z`
- Collector heartbeat: `2026-11-15T01:05:45.118Z`
- Consecutive availability failures: **0**
- Budget usage at that point: **1 public fetch**

This verifies live scheduling, public website HTTP reachability and private evidence persistence **for one cycle**. It is NOT a functional test of a website tool, security verification, proven revenue opportunity or comprehensive product inventory. Product discovery is scheduled every 6 hours and may require a product manifest if the website catalog is JavaScript-only.

Founder login through Cloudflare Access has not been independently tested from this conversation environment. Do not remove the Access guard to troubleshoot a login problem.

## What this deployed Worker does

- Every 5 minutes: public GET availability check of `https://yorphives.com/`.
- Every hour: GET availability checks on up to four least-recently-checked automatically enrolled tools.
- Every six hours: inspect the public sitemap, tool/free-tool/explore catalog links, and optional product JSON manifest. Insert newly found tool URLs into a dedicated D1 inventory.
- Daily (and once after first activation): inspect a limited **Show HN and Ask HN** RSS feed for potential products and unmet user needs. Compare title keywords against known YorpHives tools, labeling each lead **possible existing** or **potentially missing**, never proven inferior or profitable.
- Daily (and once after first activation): inspect a small sample of GitHub-reviewed npm security advisories. Record package names, severity and source, **without claiming an advisory affects YorpHives** until the package and deployed version are independently verified.
- Store compact findings, status, source links and internal daily request usage for private dashboard review.
- Report repeated failures; require founder approval for any proposed change.
- Restrict public request targets to the founder website and one fixed research feed.
- Cap public HTTP fetches to **900/day** using a D1 budget counter. If exhausted, checks stop rather than spend.
- Delete old research leads after 90 days to limit storage, retaining product inventory and incident evidence.

This is intentionally **passive monitoring and research**. There is no browser automation, code execution, GitHub writing, deployment, purchase, AI model inference, automatic repair or active penetration testing.

### Current limitations (must not be misrepresented)

- A sitemap or server-rendered catalog might omit SPA-only/unlinked tools. Missing routes cannot be inferred to be removed. The first live discovery found zero discernible tool routes; a founder-approved product manifest remains the preferred reliable coverage source.
- HTTP availability does **not** validate tool functionality or security.
- A public RSS product mention does **not** establish customer demand, organic traffic or revenue potential.
- Cloudflare Free Workers CPU time is small; extensive crawls, vulnerability scans, and full model inference are not appropriate.
- Explicit competitor feature-gap checking, **verified dependency/version vulnerability matching**, validated revenue intelligence, and event-driven free AI analysis remain later modular adapters. Public npm advisory monitoring has been added, but cannot verify relevance without an accurate dependency inventory. The existing local Python research prototype is separate and not running on Cloudflare.
- An independent external outage monitor still requires an environment outside Cloudflare. The old isolated Python watchdog is not part of this Cloudflare deployment.
- A Cloudflare Account, D1 and Access are managed services: no immediate SaaS bill within Free quotas, but **not full self-hosting** or guaranteed indefinite free access.

## Extended opportunity and security intelligence

The new read-only add-on uses **only public GET sources**:

- `https://hnrss.org/show`: software launches and product ideas.
- `https://hnrss.org/ask`: publicly discussed user problems.
- GitHub's public reviewed npm advisory listing (up to three records per retrieval) to identify advisories worth checking against the actual website stack.

All sources are fixed, allowlisted, subject to the same hard 900 public-fetch/day cap, and run only on the daily schedule or a staged first invocation. The new collector **staggers discovery, growth feeds and security-feed requests over successive five-minute Cron cycles** after initial deployment to limit Worker CPU pressure.

A product research lead is marked `possible-existing-product` only when multiple title keywords resemble an enrolled product; a nonmatching mention is `potential-missing-product` **only when a nonempty catalog is available**. When the catalog is empty or unverified, the classification is `catalog-unverified`, never a declaration that YorpHives lacks the product. Generic personal discussions and unrelated entertainment launches are filtered conservatively. These are triage labels, **not** proof of demand, feature parity or organic search volume. Actual competitor feature tests are not performed.

The new `security_watch` table stores publicly available advisory metadata with `applicability='unverified'`. The dashboard displays it in a separate **Security advisories to review** panel; it never silently converts a general advisory into an active vulnerability finding.

To claim a genuine affected dependency, a future founder-approved, **read-only** dependency inventory with exact version matching is required. No source/dependency manifest is written to the live site as part of this phase.

## Passive release detection and catalog enrollment limit

The current public YorpHives discovery pass, observed at `2026-11-15T01:20:47.268Z`, returned **`partial:no-discoverable-tool-routes`**. The Worker did not fabricate products or mark any existing tool as removed.

To improve coverage without a browser, the collector now watches same-origin JavaScript/CSS asset references on the homepage during scheduled discovery. A changed build fingerprint becomes a **website revision observation requiring founder review**; it does NOT identify which tool changed or prove that any feature is superior/inferior.

To support reliable automatic enrollment of a future JavaScript-only application, the website should eventually publish an owner-maintained manifest at `/.well-known/yorphives-products.json`:

```json
{
  "products": [
    {"url": "/free-tools/example-resizer", "name": "Example Resizer"},
    {"url": "/explore/example-app", "name": "Example Application"}
  ]
}
```

**The JSON above is only an example, not a claim that these routes exist.** The manifest is not deployed to the website and no modification to the website repository is authorized by this collector. Adding it later is a separate founder-approved website change.

## Founder budget visibility

The Product Intelligence screen now includes a **₹0 operating budget** panel. When the private Cloudflare report is accessible, it displays:

- Counted public HTTP GET requests used today out of the internal daily cap of 900.
- AI inference: disabled.
- Production browser testing: disabled.

If the private report is unavailable, it clearly shows that telemetry is not connected rather than asserting ₹0 usage. Cloudflare's own billing/usage dashboard remains the authoritative source of actual payable charges; this pilot does **not** have permission to inspect subscriptions or billing settings.

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
| `cloudflare/migrations/0001_initial.sql` | Six compact portable evidence tables |
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
