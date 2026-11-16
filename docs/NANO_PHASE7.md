# YorpMind Nano Phase 7 — Global intelligence source registry

Status: pilot implementation (2026-11-16). Existing website and HQ operational permissions unchanged.

## What it does

Expands the research discovery intake beyond GitHub and Hacker News with modular, direct public adapters:

- **DEV Community**: public developer posts tagged AI, surfaced as *unverified developer discussions*.
- **Hugging Face**: public model listings and reported engagement, surfaced as *model candidates*; do not presume open-source licensing, weights, performance or private hosting suitability.
- **OpenAlex**: bibliographic listings on autonomous AI agents, surfaced as *research references*; not independently reproduced findings or validated business demand.

Each adapter consists of a fixed source definition, strict output URL allowlist, JSON normalization, evidence label, and independent scan-state row in D1. A future connector can be added or removed without rewriting the intelligence pipeline; published source data persists separately.

## Collection limits

- Only three literal unauthenticated GET API endpoints. No requests to links embedded in API responses.
- One untried source bootstrapped per existing five-minute Cron invocation. Once all have been attempted, one due source per scheduled 8-hour window (01:25, 09:25 or 17:25 UTC).
- At most **3 new-source requests per UTC day**, using a single atomic D1 daily counter and the existing HQ shared public-fetch budget. Requests are cancelled at 5 seconds, responses limited to 64KB, manual redirect handling blocks redirect-following. Only JSON is permitted.
- At most two stored leads per scan; maximum 1,000 stored leads. Repeated canonical records dedupe. Each first-recorded lead also creates an unverified HQ `opportunities` record; existing Nano workflows subsequently route and store memory.
- New provider leads use `research-unverified` with the same conservative scoring cap as `catalog-unverified`. No source can be promoted straight to a founder-approved item.

## Security, costs, ownership

No tokens, no paid API plans, third-party LLMs, source code execution, license assumptions, crawling, scraping or automated production writes. Providers are public content sources, not agent intermediaries. Each source has limited scope; nonpublic endpoints and dynamically supplied URLs fail closed.

Schema: `migrations/0007_nano_source_registry.sql`, portable SQLite/D1, additive only.

## Current limitations

DEV contributor opinions, Hugging Face downloads and OpenAlex citations are *signals*, not proof of market demand or revenue. The network does not yet conduct independent customer interviews, benchmark models, execute apps or verify licenses. OpenAlex's currently documented no-key trial use is limited; the tiny one-call budget is intentional. External APIs may return errors or change schemas; failures are recorded as unavailable, not claimed as successful investigations.

## Verification

Automated normalization, provider allowlist, quota, duplicate records and scheduling tests use synthetic API responses. UI tests cover desktop and mobile. Actual remote response success and access-gated founder UX require separate verification on the isolated pilot.

## Longer-term design

Add an extensible source manifest with explicit owner review and domain-level consent, replayable citation snapshots, source freshness controls, corroboration between independent organizations, and research feedback. Runtime HQ agents remain read-only and the founder retains final execution authority.
