# YorpMind Nano — Phase 9: Opportunity Intelligence Briefs

Status: implementation for isolated HQ pilot, 16 November 2026.

## What it does
Converts already-stored HQ research records into **research hypotheses and structured validation plans**. It does **not** pretend that collected links prove market demand, monetization, technical feasibility or autonomous AI execution.

- Up to three **distinct-category** brief cards appear in **AI Employees → Opportunity briefs**, directly below the evidence-ready shortlist.
- Cards describe: why the topic might matter to YorpHives, a conditional build option, a possible self-hosted adoption route, an explicitly unverified revenue model, a small proposed validation experiment, source links, missing evidence, risks and **six role-specific checklists**.
- Departments are research templates, **not six independently reasoning models**.
- The existing Priority shortlist remains strict. Nothing is promoted into the founder decision queue by the new ranking.
- Research priority scores (maximum 69, never confidence) are determined by a fixed, audited keyword taxonomy: agent-workforce, private AI, QA/developer productivity, browser products. Publicity is excluded and unverified model listings are monitored rather than recommended.

## Evidence semantics
- A valid HTTPS source URL is only a **recorded link**, not a checked publisher claim.
- A Phase 6 first-party Hacker News/GitHub API check establishes platform metadata alone. Product functionality, license compliance, actual customer need, willingness to pay, adoption and revenue are **unverified**.
- Suggested build/adopt/monetization paths are **hypotheses**, not discovered facts.
- Every card lists explicit evidence gaps and requires founder approval before code changes, contacting people, spending money, building or deployment.
- Topic overlapping across multiple sources is not customer validation; independent firsthand evidence is still needed.

## Implementation and cost
- One reusable, local deterministic dossier builder; no new web requests or LLM calls.
- Reads existing D1 `nano_memories`, `nano_triage`, `opportunities`, `nano_source_leads` and `nano_investigations`.
- Creates **at most one dossier per five-minute Cron** while fewer than three exist; afterwards a single incremental dossier is possible only at UTC minutes 15/45. Maximum 50 recent candidate source records scanned per pass, maximum 250 stored dossiers.
- Stable input fingerprint prevents unnecessary writes. Evidence changes update the dossier but never alter the underlying source/memory records or founder decisions. Stored JSON has a strict 7.5KB cap and an explicit template version.
- Portable D1/SQLite schema: `migrations/0008_nano_opportunity_briefs.sql`, additive only. No new bindings, permissions, subscriptions or agent tools.
- The UI is mobile-friendly: compact collapsed cards with readable source provenance and optional department detail sections.

## Verification
- `scripts/test-nano-opportunity-briefs.mjs` exercises the actual deterministic functions and synthetic D1, including false claims, filtering, ranking, idempotence, updated evidence and no autonomous actions.
- Desktop/mobile browser CI covers the new panels using synthetic report fixtures.
- Real database counts and scheduled creation must be verified independently after isolated-pilot deployment. It is not a signed-in live founder session test.

## Next priority
After observing real briefing records, start stronger independent evidence collection: corroborated firsthand customer pain, exact license and performance testing, real alternatives analysis, and opt-in founder-reviewed experiments. This phase prepares those steps; it does not claim their outcomes.
