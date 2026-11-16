# YorpMind Nano — Phase 3: shared evidence memory

Implemented 16 November 2026. Phase 3 is **evidence memory**, not ACE learning or autonomous model retraining.

## Scope

- Shared, revision-linked memory from actual `workflow_runs`; no invented or fabricated research findings.
- Six departments read a common D1 memory table. Each memory retains its originating department, source ID, original recommendation, review state and explicit evidence limitations.
- Read-only `AI Employees → Shared memory` displays up to 20 recent memory rows and department counts. HQ report returns at most 40 entries.
- On an explicit **founder-triggered** AI investigation, at most two recent relevant memory summaries are added as *unverified, untrusted context*. The original finding remains the primary evidence.
- No automatic AI inference, strategy edits, executable tools, deployments, payments, or production website changes.

## Data model

D1 table `nano_memories` has a unique memory ID and unique workflow run ID, linked in the insert by `WHERE EXISTS(SELECT 1 FROM workflow_runs WHERE run_id=?)`. The table records:

- `memory_id`, `run_id`, `source_kind`, `source_id`
- `department`, `title`, `evidence_state`, `source_url`
- `recommendation`, `review_state`, `observed_at`, `recorded_at`

There are indexes for recent retrieval and department-oriented retrieval. A maximum of 1,000 rows is enforced at insert time; the policy never deletes or overwrites old revisions automatically. A migration/export and archival policy must be defined before reaching that limit.

## Pipeline

1. The existing Cron checks YorpHives and gathers deterministic research evidence.
2. At a 30-minute schedule boundary, the Nano orchestrator processes up to four candidates, prioritizing records with the fewest completed workflow runs.
3. A deterministic six-stage workflow is inserted if a new snapshot exists.
4. A linked memory row is inserted only if the corresponding workflow exists and the memory has not already been recorded.
5. If a workflow has been recorded but memory insertion failed, a later cycle can repair the missing memory record without duplicating the workflow.
6. Other departments can review memory in the UI. A founder-triggered AI request may consult up to two bounded memory summaries.

## Safety and quality

- Memory entries are labeled `source-recorded-unverified` or `missing`; they are **not independently corroborated**.
- Stored recommendations came from HQ source records. They are not new AI findings or proven results.
- Current memory can be low-quality; founder feedback and independent verification will be required before promoting any item into reusable learning.
- The shared-memory and inference adapters are dependency-free JavaScript. The Cloudflare AI inference provider is replaceable.
- Phase 4 will add ACE-inspired *versioned, founder-reviewed learning playbooks* and outcomes-based memory ranking. It must not modify deployable software or infrastructure.

## Verification

- `scripts/test-nano-workflows.mjs` exercises idempotency, snapshots, memory repair, departmental recall, schedule gating and no-LLM behavior using synthetic D1.
- `scripts/test-workers-ai.mjs` checks the two-memory bounded prompt context, no tools, model selection, and the daily free safety limit.
- `scripts/test-browser.mjs` renders memory records on desktop/mobile and tests disclosure and navigation.
- These suites do not establish that the live scheduled collector created real memory entries. Verify the production D1 row counts and latest Cron heartbeat separately after deployment.

## Recovery incident: empty workflow and memory panels (16 November 2026)

**Observed:** The founder's AI Employees screenshot showed zero workflow runs and zero memories despite 10 research opportunities in D1.

**Root cause:** An earlier source edit accidentally inserted literal `\\n` text inside a `//` comment in `scheduledCycle`. It turned the Nano invocation and the final `last_cron` heartbeat into comment text. Both stopped executing, although the Worker still passed JavaScript syntax checks. This was a runtime/logic regression, not a missing database table.

**Repair and prevention:**
- Restored executable Nano Cron invocation and last-cycle heartbeat.
- Moved deterministic workflows ahead of expensive research collectors.
- Added a first-run bootstrap at the next five-minute Cron when no workflow exists.
- Added `nano_workflows` status for success/failure and displayed it in the Workflow pipeline UI.
- Recorded `last_cron` at the start of scheduled execution; isolated site and incident-ledger errors from Nano processing.
- Added tests that specifically detect the literal-backslash-newline comment regression, check Cron call ordering, and verify the bootstrap and heartbeat.
- Created a one-time backfill **from the 10 existing D1 opportunities**, using the actual `nanoPlan` and `nanoMemoryFromPlan` source logic with parameterized D1 writes. No synthetic incidents, invented evidence, external inference, or production website edits.
- Verified 10 workflow runs and 10 uniquely-linked memory rows. All 10 remain labeled `source-recorded-unverified` and require founder review.
- No Cloudflare Workers AI calls were consumed by the backfill.

**Verification boundary:** Database materialization and deployed-source parity are verified. Cron health requires at least one fresh post-release scheduled-cycle heartbeat; do not infer it from old timestamps.
