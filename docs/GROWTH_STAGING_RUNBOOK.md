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
