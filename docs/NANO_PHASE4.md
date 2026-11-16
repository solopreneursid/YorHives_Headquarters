# YorpMind Nano — Phase 4: Founder-reviewed learning playbooks

Status: implementation branch (16 November 2026). The system remains advisory-only. D1 records findings, evidence, feedback and revisions; nothing changes YorpHives.com or HQ software automatically.

## What this phase adds

1. **A founder-reviewed learning ledger**, `nano_playbooks`, with an immutable entry per submitted review. Each review references a pre-existing shared memory record, inherits its department and evidence limitations, and receives a per-memory version number.
2. **Outcome feedback**: the founder chooses `useful`, `not-useful`, or `needs-evidence`; provides reusable guidance and a reason; and may attach an HTTPS evidence URL. These are feedback labels, not independent factual verification.
3. **Outcome-based prioritization**: most recent review per source determines a usefulness rank of +1, -1 or 0. These ranks are only for ordering founder-reviewed guidance and **must not be interpreted as prediction confidence, revenue proof, or verified truth**.
4. **Frontend**: AI Employees → Learning playbooks provides a compact, mobile-friendly review form and a read-only list of reviewed source memories. Version history is returned in the HQ report. History is never silently rewritten or deleted.
5. **Access**: POST /api/learning/review is only allowed behind the existing authenticated Access gate and when HQ_DECISIONS_ENABLED=true, with a same-origin and explicit founder-action header. GET and HEAD remain read-only; the learning endpoint cannot execute software or network actions.

## Apply migration

Use `migrations/0004_nano_playbooks.sql` against the existing pilot D1 database before deploying the updated Worker. Keep a D1 recovery bookmark or export first. The migration creates one table and two indexes, without changing existing evidence.

## Safety and budgets

- Max 1,000 review revisions. No background self-learning or model retraining.
- All review text and evidence URLs have tight limits and SQL bind parameters.
- New rows are only created by authenticated explicit founder submission.
- No new Cloudflare paid service, model calls, external agent relay, or third-party subscription.
- Cloudflare Workers AI remains optional and founder-triggered. Six departmental labels are evidence-routing assignments, not independently operating models.
- The original source state remains `source-recorded-unverified` unless a separate independent verification exists.

## Verification boundaries

`scripts/test-nano-learning.mjs` uses a synthetic D1 adapter to test validation, review versioning, outcome ranking, and the absence of autonomous side effects. CI browser tests use synthetic reports. Live production confidence additionally requires checking the D1 table, authenticated form submission and report rendering. Do not claim a live founder decision is tested until a founder submits one.

## Next technical priorities

Add genuinely independent source corroboration before changing evidence confidence; expand multi-department analysis from the same source; add retrospective outcome tracking and explicit founder-approved changes to learning heuristics. Do not auto-update software, payments, permissions or deployments.
