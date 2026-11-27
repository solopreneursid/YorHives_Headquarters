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

## Gate 5 — private inference (manual host bootstrap)

On the actual intended Linux machine (not a CI runner), run:
```sh
uname -m
free -h
lscpu | grep -E 'Model name|^CPU\(s\):'
df -h /
node --version
command -v ollama && ollama --version
```

Provide the results without host credentials, public IPs or secrets. Choose a compatible model and model license based on real RAM, CPU/GPU and disk. Install the approved local runtime only after selection. Keep Ollama loopback-only; do not expose port 11434 to the internet. Clone/check out the candidate using your normal GitHub credentials on the host; do not paste credentials into chat.

Run `node portable/growth/host-preflight.mjs` with GROWTH_LOCAL_MODEL and GROWTH_PRIVATE_ROOT set to the actual chosen installation. It reports loopback availability and installed model status without sending any data off-host. Use the existing signed-evidence enrollment/import workflow for actual research. Benchmark on synthetic or public evidence, record model tag, model-license review, elapsed time, actual host/model-server memory and accuracy against reviewed fixtures. The CLI's RSS alone is not model-server memory.

## Gate 6 — commercial release

First customer pilot is a separate VM/OS service account with encrypted private volume, dedicated model endpoint, signed customer entitlements and recovery tests. Verify service sandboxing on the actual host and cross-customer denial before inviting a customer. Keep license-signing private keys off customer systems. No automatic payment until pricing, provider, merchant legal entity, tax/invoice requirements, cancellation/refund terms and webhooks are approved and independently tested.

Production remains blocked until staging D1, founder browser, source failures, private model, security/recovery, and founder release approval are recorded. No live rollout, account upgrade, recurring charge or deletion is authorized by this runbook.
