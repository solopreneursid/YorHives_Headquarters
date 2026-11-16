# YorpMind Nano — Phase 5: Automatic evidence-gated triage

## Goal
Stop treating every observed external mention as a founder decision. Automatically rank up to 40 recent HQ evidence memories into **review now** and **research first**, preserving all original source records and learning versions. Show a maximum of three ready items in a compact, mobile-friendly founder review queue.

## Architecture
- Every five-minute Cron performs existing website monitoring and Nano source orchestration.
- Each half-hour (or next five-minute bootstrap while triage is empty), `nanoTriageScheduled` evaluates up to 40 latest, revision-linked memories.
- The deterministic evaluator uses source URL syntax, whether a description and recommendation are substantive, freshness, source category, relevance and finding severity. An HTTPS link is only a *recorded source*, never verified evidence.
- `catalog-unverified` leads are capped at a review score of 34 and cannot become founder-ready. Missing evidence cannot become founder-ready.
- A score >=65, non-catalog category and a valid source URL are needed for `review-now`. A score is **review urgency, not confidence, business value, source reliability, or proven revenue**.
- Founder review states (accepted, implemented, verified, rejected, snoozed) remove already-handled source threads from the ready queue. Latest source revision wins on the dashboard. Historical memories remain immutable.
- D1 `nano_triage` records evaluations separately from source observations. Changed source fingerprints reset stale AI advice; unchanged records do not generate duplicate writes.
- The review queue and badge now count only evidence-ready sources. Unverified items stay accessible under a collapsed **Research backlog**.
- The optional **Learning playbooks** feedback form is collapsed by default. No founder review is fabricated.

## Optional AI adapter / zero-spend guard
- `nanoAutoAiOnce` supports one **optional** read-only Cloudflare Workers AI assessment per UTC day, only for an eligible, high-priority (score >=85) operational finding, and only if `HQ_AUTO_AI_ENABLED=true`.
- Disabled by default on the pilot because free-tier usage and account-wide model billing must be independently verified. No automatic model calls are required for ranking.
- A D1 atomic `hq_auto_ai_attempts` quota key prevents more than one auto-attempt per day. The same `hq_workers_ai_requests` daily 2-request ceiling is shared with founder-triggered inference. Workers AI errors fail closed without retry.
- AI text is stored only as an explicitly **unverified advisory** and cannot become source truth.
- Founder-only UI/API actions and existing Cloudflare Access gate remain unchanged.

## Database rollout
Apply `migrations/0005_nano_triage.sql` to D1 before deploying the new Worker. Record a recovery bookmark first. This is an additive table/index migration; existing workflow, memories, decisions and playbooks are not rewritten.

## Verification
- `scripts/test-nano-triage.mjs` tests rankings, missing evidence, unverified catalog, idempotent persistence, single-daily AI quota and no automatic actions, using synthetic DB data.
- `scripts/test-browser.mjs` checks the compact queue and collapsed research backlog on desktop and mobile. CI is synthetic, not a signed-in real founder browser test.
- After pilot deployment, verify Cloudflare D1 triage counts, scheduler heartbeat, status and binding retention. Founder review remains the sole authority for decisions.

## Next phase
Independent source corroboration; department-specific critique/quality signals; output usefulness outcome tracking; founder-authorized refinement of rules. The agent must not change YorpHives.com, HQ code, security settings, billing or deployments itself.
