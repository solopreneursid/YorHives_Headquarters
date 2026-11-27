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
