# YorpMind Nano — Phase 2: deterministic orchestration

Implemented 16 November 2026. This is **an original, PocketFlow-inspired minimal node/state orchestration layer**, not a copied or installed PocketFlow library. It intentionally avoids a new runtime dependency and requires no separate scheduler or server.

## Workflow

Every 30-minute cron window, at most 4 recent existing HQ observations are eligible (open findings and unvalidated opportunities). They move through a bounded deterministic pipeline:

1. **Observe:** use existing HQ evidence; do not fetch new sites.
2. **Route:** select a department using category/title rules.
3. **Evaluate:** check whether the stored description exists.
4. **Evidence check:** mark the collected source as *recorded, not independently verified*, or mark evidence missing.
5. **Recommend:** preserve the stored advisory; no hallucinated new recommendation.
6. **Founder review:** mark pending, never authorize deployments.

The engine does **not** call any LLM, network endpoint, GitHub, website-write, deployment or payment API. All stages produce provenance and review state; they are **not** proof of a live AI employee thinking or an independent verification of evidence.

## Persistence

- Existing HQ D1 gains a `workflow_runs` table with two supporting indexes.
- Each source record and its bounded snapshot yields a deterministic `run_id` for duplicate suppression.
- New evidence or recommendations produce a new revision while older revisions remain unchanged.
- A maximum of 1,000 workflow rows is enforced in the insert statement. Export/retention strategy will be needed before this limit.
- Each row stores six stage outcomes in `stages_json`, the proposed department, original recommendation, evidence state and founder-review state.
- The public website is never changed; all records remain private under the HQ Access gate.

## Frontend

The **AI Employees → Workflow pipeline** panel shows the latest 20 of 60 retrieved historical records, department routing, review status, evidence limitations and the six expanded stages. It is scrollable and mobile-responsive.

## Boundaries and missing capabilities

- Workflow execution is deterministic, not an autonomous language model call. Cloudflare Workers AI remains a **separate founder-triggered** investigation capability with an HQ-specific 2 requests/day limit.
- Routing uses simple rules and may misclassify ambiguous records. Independent QA and founder review are still required.
- Live workflow entries are created only when the scheduler reaches the orchestration window and eligible observations exist.
- No shared episodic memory, ACE learning or MemRL feedback ranking yet. Those are subsequent phases.
- No auto-approved software or runtime upgrades and no autonomous modifications to production infrastructure.
- Source snapshot stored in `src/hq-worker.mjs`; this is a portable JavaScript design, albeit currently deployed to Cloudflare D1 and Workers.

## Verification

- `node scripts/test-nano-workflows.mjs` covers routing, stage progression, missing evidence, deduplication, immutable revision history and scheduling.
- `scripts/test-browser.mjs` covers the rendered workflow panel and details at desktop and mobile sizes.
- Disposable D1 integration drill confirmed `INSERT … SELECT … ON CONFLICT DO NOTHING` persisted one row and ignored a duplicate; temporary databases were deleted.
- **Still unverified:** a live scheduled invocation producing an actual workflow record from production findings/opportunities, and completeness of independently gathered evidence.
