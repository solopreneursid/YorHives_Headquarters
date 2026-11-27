# Growth Intelligence — implementation and release plan

Status: **integrated six-tab candidate; not deployed to the live five-tab dashboard**.
Source of truth remains the current five-tab HQ release lock in hq-release.json. The separate
liveModuleGitBlobs map must not be rewritten to describe an unverified candidate.

## Architecture

Existing sources -> existing Revenue Intelligence -> growth-intelligence-adapter.mjs ->
growth-intelligence.mjs -> founder-reviewed project dossiers ->
growth-intelligence-store.mjs (optional internal D1 evidence persistence).
Existing first-party aggregate Growth Evidence -> read-only metric adapter.
Optional future D1 persistence -> migrations/growth/0001_growth_intelligence.sql.

No independent application, email service, vendor data warehouse, paid API, new cron,
model credentials, sales CRM or mutable web/repository permissions are required.

PROJECTS config initially contains yorphives, globalgov and taxpulse. New
projects supply the same typed configuration (id, name, audiences, keywords), not a
fork of the engine. The project and opportunity keys provide database grouping.
Future multi-tenant external commercialization needs an additional enforced tenant
boundary; **project IDs alone are not a tenant-security mechanism**.

## Implemented in this branch

- Multi-project configuration validation and reproducible evidence scoring.
- Strict allowlist of public source hosts and source classifications; rejected stale
  evidence, future timestamps, HTTP URLs, credential-bearing URLs and off-allowlist hosts.
- Bounded deduplication, email-redacted descriptions and no auto-discovered contact lists.
- Research dossier with explicit evidence links, scores, review state and warnings.
- Pure founder review state machine and unsent, recipient-free communication drafts.
- Adapter from existing Revenue Intelligence and first-party Growth Evidence response shapes.
- Analytics that explicitly leave unique users, customers and revenue **null** when unknown.
- Additive seven-table D1/SQLite schema (projects, audiences, sources, opportunities,
  reviews, drafts and outcomes) and offline migration constraint check.
- Bounded parameterized internal D1 research upserts and project-scoped reads. The
  store retains existing founder approval statuses when evidence is refreshed.
- Isolated Node regression suite and workflow. The candidate Worker and manifest are updated; previous live hashes and release metadata are retained separately.

## Boundaries

Allowed: public GET evidence already collected by approved HQ source adapters, local
analysis, research recommendations, internal evidence persistence and founder review.
Not allowed: targeting individual contacts, sending messages, auto-posting to
communities, bulk scraping, changing connected project sites or GitHub repositories,
deleting data, deploying, payments, broad third-party agent intermediaries.
Agents have **no** external action permissions. A draft is never a queued email.

No inferred market fit is displayed as verified demand. A public conversation is
not a customer lead. Public analytics are browser events, not unique human users.
Revenue remains null absent an authenticated verified accounting source.

## Rollout milestones and blocking gates

1. **P0 (candidate implemented):** approve model, schema, source allowlist, and
   project registry. Validate migration against a disposable D1 database only.
2. **P1 (implemented in candidate):** the evidence adapter is connected to
   a **GET-only** /api/growth-intelligence endpoint behind Cloudflare Access.
   Growth Intelligence is the sixth tab in the current UI.
   Do not restore the retired HQpulse layout or its six-page assets.
3. **P1 (pending):** source-by-source public permissions/robots, evidence expiry,
   bounded research schedules, fail-closed source health and project-specific queries.
   Reuse existing revenue research where possible; do not increase scheduled
   fetches until daily quota and source terms are independently reviewed.
4. **P2 (candidate logic only):** founder-reviewed opportunity and draft persistence,
   audited review state transitions, XSS-safe display, no send/publish endpoints.
   Review authorship must be established through the existing Access owner guard,
   **not** accepted from a client-provided actor string.
5. **P3 (partially implemented):** connect real project-specific aggregate analytics
   with provenance, short retention, measured outcomes and no invented revenue or
   visitor counts. Only YorpHives currently has a known aggregate endpoint.
6. **P3 (pending):** schedule bounded daily research using an existing cron,
   deduplication, source-specific cache TTLs, local rate budget and failure alerts.
7. **P4 (pending):** offline unit/migration and browser tests, second-party security
   assessment, backup/restore drill, authenticated real browser verification,
   Cloudflare binding compatibility, manual release and staged rollback drill.

## Release procedure

- Run node --test tests/growth-intelligence*.test.mjs.
- Run python3 scripts/verify-growth-schema.py.
- Run node scripts/verify-current-hq.mjs to verify candidate source pins, the retained prior live module map, and the six-tab contract.
- Do **not** run the growth migration on production during this candidate review. The candidate manifest pins updated source without changing the prior live module map.
- For eventual release, review the pinned candidate against the retained live snapshot and test full
  desktop/mobile browser navigation, API authorization and rollback.
- Deploy only through the founder-approved HQ production release action after
  CI, Access checks, D1 backup/restore validation and environment approvals.

## Candidate user experience (not yet deployed)

Growth Intelligence > project selector > audience hypotheses > evidence-ranked
opportunities > partnership/promotion suggestions > draft preparation > founder
review > measured first-party outcomes. Empty evidence renders as "not observed",
not fictitious leads. No recipients or autonomous distribution controls.

## Operability

Run the engine locally on Node 20+ or import it in the current Worker bundle.
A persistent private model may **summarize** already-qualified public source
evidence later; it must not assign authoritative scores, learn from contact
identities, or receive network/send/write capabilities. Deterministic scoring
remains the default and fallback when model inference is unavailable.

## BizBot-inspired business-development direction (2026-11-27)

Reference: https://bizbot.zvo.cn/ and https://www.leimingyun.com/. Vendor-described workflows are research references, not verified product performance or authorization to reuse software. Implement independently.

The subsystem must progress from general topic discovery to portfolio product knowledge, organization/project-level public research, evidence-backed product fit, technical integration assessment, specific proposal drafts, founder handover and outcome learning. Maintain product profiles as configuration, not per-project forks. The current candidate introduces product profiles, fit classifications and source-specific drafts; named organization verification and targeted source discovery are not yet implemented. A topical match is not a prospect, verified buying intent or permission to contact.

Next engineering sequence:

1. Add product profiles for HQventures and future offerings based on confirmed product inventory.
2. Build bounded public organization/project discovery using authorized source adapters and existing scheduling budgets; prioritize public documentation, official organizational sites, and public software repositories. No contact harvesting or arbitrary crawling.
3. Create organization-level evidence dossiers, deduplicate targets, verify actual product compatibility, record conflicting evidence and distinguish current needs from hypotheses.
4. Produce a founder-ready proposal with source references, candidate integration, mutual benefit, risks, and a permitted channel; do not send it.
5. Record founder decisions and manually reported responses, verified intent and outcomes in the internal journal; use feedback to improve ranking.
6. Add private local model-assisted research only after deterministic evidence and security controls pass. No model gets outbound credentials or browser messaging authority.

BizBot advertises automatic communication and follow-up. Those execution features are explicitly excluded from HQ under existing founder governance. No autonomous sending, automated contact or publishing is authorized. Founder remains the executor. No claims about sender authenticity, verified sales or actual BizBot effectiveness.

## Organization scout and founder journal implementation (2026-11-27)

The candidate now includes HQventures as a fourth project profile. `growth-prospect-discovery.mjs` uses four fixed GitHub public repository search windows per UTC day (02:35, 08:35, 14:35, 20:35). A claim in the existing private D1 status table prevents repeated daily attempts; all requests use the shared quota, GET, bounded response streaming, no credentials and no redirects. Only public non-fork, non-archived repositories with organization-owner metadata and canonical GitHub URLs are considered. Evidence is capped at eight records per project scan and expires after 36 hours. Scan failure, stale evidence and zero matches remain distinct. Repository metadata does not verify a legal entity, need, integration feasibility, sales intent, or permission to contact. Actual source accessibility and match quality still require a controlled staging run; tests use synthetic fixtures.

Growth review now has a separate authenticated POST route `/api/growth-intelligence/review` and founder-only UI controls. It requires `HQ_DECISIONS_ENABLED=true`, the existing Access owner guard, exact same-origin founder header, and approved migrations 0001 and 0002. A revision-checked conditional journal INSERT and atomic SQLite trigger update the internal review projection; no sending or external execution occurs. Audit events cannot be updated or deleted via ordinary SQL. A completed action is only founder-reported, never executed by HQ. The public research GET remains read-only; if the review schema is unavailable, the UI exposes no review controls.

**Deployment boundary:** neither migration has been applied to production. No scheduled discovery has executed from this candidate in production. Keep the eight-module previous live snapshot separate from the 13-module candidate. Run source integrity, all regression workflows, approved staging D1 migration/rollback and real authenticated browser verification before requesting release.

**Remaining:** wider first-party organization/directory sources and independent entity verification, cross-project integration evidence, multilingual contextual proposals, feedback and outcome history beyond review events, intent assessment from founder-reported responses, local-model orchestration and tenant-isolated commercial packaging. Public repository discovery is a first source adapter, not complete BizBot parity.

## Advanced BizBot-inspired candidate

The advanced candidate adds four daily source windows at UTC 02:45, 08:45, 14:45 and 20:45, alternating public npm registry search and fixed official documentation (Apache PDFBox, USAJOBS, OpenFisca, n8n). Official URLs are reviewed references, not verified partnership prospects. Website requests are conditional on robots.txt, restricted to the exact configured origin/path and reject redirects, oversized responses or invalid content. No arbitrary user-supplied URL is fetched. The extra daily network allowance is bounded at four to eight requests, subject to HQ's existing quota. npm scope is not proof of company ownership. Actual hosted source access and relevance remain unverified.

Technical diligence derives interface, format, authentication and licensing signals, then lists compatibility checks; it does not claim tested integration, commercial intent or license clearance. English, Hindi and Spanish proposal variants cite original evidence and remain unsent; language/context requires review. Source evidence is not translated by the deterministic templates.

Migration 0003 adds a structured, append-only founder response journal. Recording a response requires an already recorded manual founder action, valid authenticated same-origin submission and the existing founder decision flag. No message bodies, contact addresses or revenue amounts are stored. Idempotent event IDs distinguish retries. Intent classifications and the latest 100-opportunity learning summary are founder attestations, not confirmed sales. A do-not-contact event suppresses intent for that opportunity; cross-organization suppression and automated ranking changes are not implemented.

### Portable local specialist runtime

The dashboard's public evidence export supplies a bounded JSON dossier without review notes or responses. On a private Linux host running Node 22+ and a locally installed Ollama model, execute:
```sh
GROWTH_PRIVATE_ROOT=/private/customer-data GROWTH_LOCAL_MODEL=<installed-local-model> node portable/growth/cli.mjs analyze customer-a growth-public-evidence-taxpulse.json
GROWTH_PRIVATE_ROOT=/private/customer-data node portable/growth/cli.mjs list customer-a
```
Replace the model tag and directory with your real installation configuration. The runner calls only 127.0.0.1:11434, with no model tools, validates evidence references and keeps all model output explicitly unverified. Four sequential roles collaborate on evidence and prior unverified findings. Missing or invalid model responses are marked unavailable. No model is installed or running as part of this PR. Real model accuracy, prompt-injection resilience, availability, and resource consumption require testing.

### Commercial deployment boundary

The initial distribution model is one customer per private OS account/container and dedicated volume, with a distinct SQLite database, identity marker and private filesystem permissions. The CLI demonstrates separate databases and rejects tenant traversal, symlinks and mismatched records; same-process tests do not establish hostile-tenant isolation. Do not expose this CLI as an HTTP SaaS service. Never share a privileged process, filesystem root, model logs, tokens, or backup bucket across untrusted tenants. Production packaging needs per-customer authentication, process and network isolation, encrypted storage and backups, secret management, quotas, retention/export/deletion policies, upgrade/rollback tooling and independent security review. Existing HQ remains a single-founder deployment. No customer instance has been provisioned.

**Release status:** sixteen candidate Worker modules, previous eight-module live snapshot retained, three additive migrations not applied. Local runtime is outside the Worker bundle. Full hosted source, physical device, authenticated review/outcome flow, restore, and real private-model tests remain release gates.

## Release readiness, signed synchronization and commercial pilot

The readiness candidate adds an isolated CI public-source observation job using actual network GETs and a disposable SQLite database. It simulates scheduler timestamps only, records real check time separately, limits the full observation to 20 requests and distinguishes unavailable/blocked sources from empty or observed responses. It does not test Cloudflare egress or an authenticated hosted session. A separate local recovery drill takes a pre-migration and post-migration SQLite backup, restores each into separate files and verifies contents, foreign keys, integrity and audit protections. The Worker handler is also exercised with synthetic Access identity and actual SQLite review/outcome persistence; this is not an actual Cloudflare login.

Each daily project scout optionally spends one additional shared-budget GET to cross-check the first GitHub organization via its public organization endpoint. Account confirmation is not legal identity, authority, business intent or compatibility. No returned organization email is retained. Partner technical compatibility still requires a real isolated test against agreed interfaces and approved credentials.

Signed offline synchronization: on a trusted founder-controlled machine generate an Ed25519 signing key, restrict private key access to the founder, and enroll its public-key SHA-256 fingerprint in each destination. Export public evidence from the HQ tab; the CLI `sign` command creates a tenant-bound signed envelope expiring in 24 hours. Transfer the file directly to the destination. The CLI `import` verifies the pinned fingerprint, signature, destination, validity period and public source policy, then atomically claims the nonce in the private customer database before inference. Replayed envelopes are rejected across restarts. Interrupted imports require a fresh founder-signed envelope. Signatures authenticate the transfer, not the original source or the model's conclusions. No bidirectional automatic sync or server credential is introduced.

CLI configuration:
- `sign customer-a dossier.json signed.json`: GROWTH_SIGN_PRIVATE_KEY points to the local mode-0600 signing key.
- `fingerprint`: GROWTH_SIGN_PUBLIC_KEY points to enrolled public key.
- `import customer-a signed.json`: GROWTH_PRIVATE_ROOT, GROWTH_LOCAL_MODEL, GROWTH_SIGN_PUBLIC_KEY, GROWTH_SIGN_KEY_ID; use GROWTH_CUSTOMER_ID=customer-a and GROWTH_REQUIRE_SIGNED=true on a destination.
- `benchmark customer-a dossier.json`: run only on a private non-commercial evaluation installation. Reports wall-clock and per-specialist elapsed time plus CLI RSS; does not measure model server memory or independent quality. Real model installation, hardware, model license and measured benchmark remain manual prerequisites.

Shadow scoring proposes a small bounded project-level adjustment only when at least ten distinct founder-attested outcomes are evaluable. Suppression is excluded from proposed candidates. The dashboard shows the proposal; it never changes production ranking. This is selection-biased exploratory calibration, not an estimate of market conversion.

Commercial pilot: offline signed evaluation/standard/professional entitlements bind an expiry and plan to one customer identity; verification rejects wrong customer, tampering and expiration. Entitlements do not assert a paid subscription or charge money. The commercial CLI requires signed imports, enrolled entitlement public key/fingerprint and customer identity. The dedicated-VM systemd service template restricts the runner to localhost networking, a private state directory and unprivileged service user; it has not been installed. Use a separate VM/model service and encrypted volume per customer; root-controlled environment file and signing/entitlement public keys, no vendor private signing keys on customer hosts. Do not share Ollama or database directories across customers. Customer operators with host root can alter local enforcement: offline entitlements are not tamper-proof DRM.

Before any hosted pilot: provision a dedicated staging Worker and D1 after confirming account capacity/cost, configure founder-only Access, run the real browser and source checks, validate D1 backup/restore using its native mechanism, and verify no production bindings. Before selling: select legal terms and model/dependency licensing, deploy the dedicated customer host with encrypted backups, review service isolation and authentication, configure entitlement issuance/renewal and test customer onboarding. Payment integration, pricing, tax compliance and automated subscriptions remain unimplemented.

Production lock: 17 candidate modules, prior 8-module live snapshot preserved. No production Cloudflare mutations or migrations. Real Cloudflare account inventory contained no dedicated HQ Growth staging resources; avoid creating unapproved capacity or borrowing other projects' databases.
