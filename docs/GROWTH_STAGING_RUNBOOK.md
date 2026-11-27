# Growth Intelligence — controlled staging and founder release runbook

**Scope:** HQ PR #56 only. Never modify production HQ, globalGOV, TaxPulse, YorpHives, or another project's database to stage this candidate. Runtime agents remain research-only; this runbook is for the founder or authorized development operator.

## Gate 1 — capacity (manual)

The Cloudflare account inventory returned 11 D1 databases and no dedicated Growth staging database. The billing subscription read endpoint returned HTTP 403 (missing Billing Read). The Workers account setting "standard" is not proof of a paid subscription or included capacity.

1. Sign in to Cloudflare Dashboard and select the account containing HQ.
2. Open account billing/subscriptions and the Workers & Pages plan/usage page. Confirm whether Workers Free or Workers Paid is active, current D1 limits, included database count and incremental charges.
3. Share plan name and capacity/usage only; redact account/billing identifiers, card details and any secrets. If the connector offers permission changes, grant Billing Read only, not Billing Write. Do not upgrade or delete a database to make room without a separate decision.
4. Proceed with a new staging database only when its capacity and cost are confirmed.

## Gate 2 — separate hosted staging

Proposed resources: Worker `yorphives-hq-growth-staging`; database `yorphives-hq-growth-staging-db`. These are reserved names in the runbook, not provisioned resources.

- Confirm that neither name exists, then create an empty dedicated database. Verify the returned database UUID is not any existing production or other-project UUID.
- Bootstrap only the minimal existing HQ schema required by the candidate; use synthetic test records. Apply growth migrations 0001–0003 in order. Never import real customer or founder data.
- Upload exact modules pinned by the PR's release manifest, after all CI checks. Use a fresh, separate Worker. Initially disable workers.dev, preview URLs, custom routes and Cron; do not bind production service endpoints, production D1, analytics, or inference.
- Create a distinct Cloudflare Access application and exact founder allow policy for the staging hostname; validate JWT audience and team domain on the Worker. No bypass, no public policies, no shared production audience. Verify unauthenticated denial before enabling the staging URL. Configure only the staging database and founder review flag. Missing unrelated production services must show unavailable; never fake them.
- Compare binding inventory against the intended staging database UUID and Access audience. Reject production binding IDs. Do not enable an unattended scheduler before isolation is verified.
- Run bounded source checks separately, respecting cooldown and robots/size limits; record actual results. Never make source success a fabricated gate.

## Gate 3 — native D1 restoration (staging only)

1. Create a recoverable pre-migration bookmark/export using Cloudflare's native supported mechanism; store the backup under private founder control.
2. Apply additive migrations and synthetic review/outcome events.
3. Obtain a second bookmark/export, and compare synthetic counts, schema and integrity checks.
4. Perform a controlled restore to the first checkpoint **only on the dedicated staging database**, with staging traffic/collectors stopped. Confirm pre-migration marker and absence of the new synthetic tables/events as appropriate.
5. Reapply migrations, restore/reseed synthetic fixtures, and validate review/outcome persistence. Record actual native restore evidence; local SQLite recovery is not Cloudflare Time Travel verification.

## Gate 4 — real founder browser session (manual)

The founder uses their own Cloudflare Access login/OTP; never disclose a password, session token or OTP. Open the verified staging URL and check the six tabs, Growth project selection, original evidence links, localized proposals and public-evidence export. Record a synthetic founder review and response, reload, verify persistence and shadow-only scoring. Verify desktop and mobile layout. Check signed-in session diagnostics; unrelated unbound production health services must not be misrepresented as healthy. Open a private browser session and confirm unauthenticated rejection. Report pass/fail, screenshots with private data hidden, and browser errors.

## Gate 5 — managed serverless inference (no personal host required)

The HQ does not require a continuously running Linux machine. The production Worker already has a Cloudflare Workers AI binding; the isolated staging Worker must receive its own AI binding only after the founder completes the authenticated-browser and anonymous-denial checks in Gate 4.

After Gate 4 passes:
1. Take a new native D1 Time Travel checkpoint for the dedicated staging database.
2. Apply `migrations/growth/0004_serverless_ai.sql` to staging only. Verify the three AI tables (`growth_ai_usage`, `growth_ai_analyses`, `growth_ai_claims`), foreign keys and append-only triggers.
3. Add the Cloudflare Workers AI binding to the staging Worker and set `HQ_GROWTH_AI_ENABLED=true` for staging only. Do not add this flag to production.
4. Keep all automatic AI scheduling disabled. Inference is triggered only by an authenticated, same-origin founder action from the Growth Intelligence page.
5. Use one synthetic/public-observed opportunity to verify one real model response, the stored unverified advisory, the evidence fingerprint cache and the daily quota ledger. Confirm a repeated request returns the cached result without another inference.
6. Verify that a third new analysis in the same UTC day is rejected, a rejected opportunity cannot be analyzed, unapproved source hosts are rejected, and an unauthenticated or cross-origin request is denied.
7. Inspect Cloudflare Workers AI usage after the test. The HQ limit of two new analyses/day is an application safety cap, not a guarantee of zero provider charges. Do not raise it without reviewing actual usage and pricing.

The local Ollama/Node host-preflight procedure remains optional for a separately approved customer-hosted/offline edition. It is not a blocker for the hosted HQ and must not be used as a reason to provision personal hardware.

## Gate 6 — commercial release

For a customer-hosted/offline edition only, a first pilot may use a separate VM/OS service account with encrypted private volume, dedicated model endpoint, signed customer entitlements and recovery tests. This is optional and separate from the Cloudflare-hosted HQ. Verify service sandboxing on the actual host and cross-customer denial before inviting a customer. Keep license-signing private keys off customer systems. No automatic payment until pricing, provider, merchant legal entity, tax/invoice requirements, cancellation/refund terms and webhooks are approved and independently tested.

Production remains blocked until staging D1 recovery, founder browser verification, public-source behavior, security/recovery and founder release approval are recorded. If managed AI is not approved for production, its feature flag must remain off; a personal model host is not a release requirement. No live rollout, account upgrade, recurring charge or deletion is authorized by this runbook.

## Staging execution record — 2026-11-27

Founder screenshot confirmed Workers Paid. D1 database `yorphives-hq-growth-staging-db` created in APAC (UUID `0f7a97e7-7b22-4076-a116-e34595833cc5`). Native Time Travel checkpoint captured before migration; all three migrations applied; two synthetic reviews and one synthetic outcome recorded. Restored pre-migration bookmark, verified pre-migration marker and zero growth tables, then reapplied migrations and verified eight growth tables and one synthetic opportunity. No production database was restored or migrated.

Staging Worker `yorphives-hq-growth-staging` uploaded from the 17 locked modules at candidate commit `4f93dfe0315d87fad5bbbc0c8727328cb24b4724`, which passed all four CI workflows. Separate staging entrypoint (source in `src/staging-entry.mjs`) has no scheduled handler and denies unrelated mutation methods. Distinct worker-specific Access application and exact single founder email allow policy configured, and independent audience and five-binding inventory verified. No production services or inference bindings. workers.dev enabled after checks; preview URLs disabled. URL: https://yorphives-hq-growth-staging.solopreneursid-proy.workers.dev/

Pending actual founder browser authentication, anonymous denial smoke test and real Cloudflare source collection. External unauthenticated network test was unavailable in the assistant environment; do not claim hosted access verified. Existing synthetic base tables are intentionally minimal, so unrelated HQ tabs may report unavailable. No production release, plan change, or commercial deployment performed. Usage-dependent charges remain possible under the existing paid plan.


## Serverless AI staging migration record (2026-11-27)

Target: `yorphives-hq-growth-staging-db` (`0f7a97e7-7b22-4076-a116-e34595833cc5`), APAC primary. The migration was applied only to this isolated staging database.

- Pre-migration Time Travel bookmark: `00000008-00000000-00005130-4ddaba2569014c3f5222c3821a77eab3`.
- Applied: `migrations/growth/0004_serverless_ai.sql`.
- Post-migration Time Travel bookmark: `00000008-00000002-00005130-26d504663f39fceff9a7bfbe7f923ab0`.
- Verified tables: `quota`, `growth_ai_analyses`, `growth_ai_claims`.
- Verified triggers: `growth_ai_analyses_no_update`, `growth_ai_analyses_no_delete`.
- Existing `growth_opportunities` count remained 1.
- AI analysis count 0; AI claim count 0; shared quota rows 0.
- No inference was run. The staging Worker still requires the candidate code deployment, founder browser authentication check, and staging-only AI binding/feature-flag activation.



## Serverless candidate Worker deployment record (2026-11-27)

- Staging Worker: `yorphives-hq-growth-staging`.
- Preview URL: `https://yorphives-hq-growth-staging.solopreneursid-proy.workers.dev`.
- Candidate Worker version: `6` (`248ce559-b341-4eef-8bda-24d67929f7cf`).
- Active staging deployment: `db9f385c-6a63-4837-8b23-dae698a40c65`, 100% on version 6.
- Previous staging deployment: `6d5b7066-93b4-4ccd-b0ca-d471689169b3`, previous version `d514ddfa-154c-4ca4-b58e-081fb8927fe3` retained for rollback.
- 19 modules uploaded (18 locked candidate modules plus `staging-entry.mjs`); all 18 source-module Git blob hashes verified before upload.
- Existing Access and staging D1 bindings preserved. No AI binding and no `HQ_GROWTH_AI_ENABLED` flag were added; inference remains disabled.
- Staging schedule list remains empty. No Queue or Workflow was created.
- Production HQ was not modified. Read-only post-deploy check showed its active version `fdbef0dc-31ff-4428-854c-7852f27c9c65`, deployment `19f886c6-485c-42d1-b7d1-20d22b6b24e9`, existing AI binding and `*/5 * * * *` schedule unchanged.
- Remaining manual gate: founder must open the preview URL in a browser, verify Access login and dashboard load, then verify that an unauthenticated/private session is denied. Do not enable AI until that check passes.



## HQ reporting schema bootstrap (2026-11-27)

The founder's authenticated staging-browser screenshots showed that Growth Intelligence loaded while Home, Health, Products, Revenue and HQconnect displayed the generic HQ-report-unavailable state. Diagnosis: the dedicated staging D1 database had the Growth schema but lacked the pre-existing HQ reporting tables queried by `/api/report`.

- Read-only comparison of production and staging `sqlite_master` metadata identified 25 missing HQ tables and 36 missing indexes. Production row data was not queried or copied.
- Added `migrations/0015_hq_reporting_schema.sql` to the candidate repository and applied it only to `yorphives-hq-growth-staging-db`.
- Post-migration Time Travel bookmark: `0000000b-00000004-00005130-c480cbc0f5374163ea7b260a5f59a367`.
- Staging now has 40 tables, 44 indexes and 9 Growth append-only/guard triggers. Every production HQ table/index object is present in staging; Growth-specific objects remain additional.
- Executed 25 read-only SQL checks matching the report's table reads and joins: 25 passed, 0 failed.
- Preserved staging row counts: `opportunities` 1, `growth_opportunities` 1, `status` 1, `quota` 0, `growth_ai_analyses` 0 and `growth_ai_claims` 0. No production records or founder evidence were imported; no inference was run.
- Three pre-existing table-definition differences remain documented: staging `opportunities` has the same columns but looser nullability than production (its existing row has no null required values); staging `quota` enforces nonnegative usage more strictly; `status` differs only in SQL formatting.
- Staging Worker remains version 6 and production Worker/deployment/schedule remain unchanged.
- Staging intentionally has no production service bindings for HQconnect inbox, edge watchdog or perimeter monitor. Those optional panels must report their own unavailable/unverified status; staging must not read production inbox or monitoring services.

Next verification: reload the authenticated staging dashboard and confirm the core report-backed sections now render. Then test anonymous denial separately. Do not enable Workers AI until the browser and API checks pass.


## Latest staging recovery and access verification (2026-11-27)

- Candidate `e56cce7ab6087402677bd2b73846a92e87895ce1`: all four CI workflows succeeded; 41 deterministic tests passed; 25/25 HQ reporting queries passed. Actual CI public-source collection returned evidence from 11/12 configured checks; n8n documentation exceeded the response bound. These are not hosted Worker source observations.
- Reverified the dedicated staging database and five-binding inventory, exact founder-only Access policy and separate audience. No AI binding or flag; no cron; production Worker version remained `fdbef0dc-31ff-4428-854c-7852f27c9c65`.
- Native latest-schema Time Travel drill: temporarily disabled the staging workers.dev endpoint (previews already disabled), captured a bookmark, wrote one synthetic marker, restored the bookmark and compared the ordered schema objects and founder journal/opportunity records. All 91 schema objects matched; one saved founder review and one opportunity remained; zero outcome/AI analysis records; temporary marker absent. Restored staging endpoint. This verifies native staging recovery including the newer reporting and AI schemas, not production recovery or off-platform encrypted backups.
- Independent anonymous Browser Run request to staging root displayed a Cloudflare Access challenge; HQ dashboard content was not returned. No authentication bypass or user credentials used. A single bounded Browser Run request may count toward existing plan usage.
- Workers AI model catalog confirms `@cf/ibm-granite/granite-4.0-h-micro` exists as a text-generation model. No inference invoked; provider usage/quality still unverified.
- Remaining manual gate: signed-in reload of all six tabs following the latest reporting-schema bootstrap; TaxPulse synthetic manual-completion and response recording must be performed by the founder, not fabricated by the development operator. Once this is verified, controlled staging-only AI activation and hosted collection verification can proceed. No production release authorized.
