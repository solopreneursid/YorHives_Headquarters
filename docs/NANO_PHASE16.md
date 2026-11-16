# Nano Phase 16 — Founder-only Research Decisions

## Purpose

Give the founder a simple permanent review history for Phase 12–15 GitHub
research candidates: what is worth examining, what is unverified, and what
a possible **future, human-authorized** experiment should limit.

This phase saves planning intent. **It does not grant any HQ agent permission
to run code, change repositories, use external services, spend, install
dependencies, or deploy anything.** All scientific, license, authorship,
dependency, hardware and operating-cost claims retain their Phase 15 caveats.

## Founder experience

The **Phase 16 · Founder research decisions** section is available in
**Discover → Research journals** and **AI Employees**.
Each verified public repository candidate has an expandable evidence card:
source links, current manifest SHA, license/hardware unknowns, review history,
and a collapsed form requiring:

- Decision: *needs evidence*, *shortlist for manual diligence*, *defer*,
  or *plan an isolated test* (**not permission to perform one**).
- License concern: *unreviewed*, *manual legal review*, *potential blocker*.
  There is intentionally **no "license cleared" option**.
- Technical concern: *unknown*, *needs validation*, *blocked*.
- A written reason and next **manual** step (16–350 characters each).
- Proposed **maximum budget in INR** (0–5000) and **maximum runtime minutes**
  (0–120). Unless planning a future isolated test, both must be **zero**.
  An isolated-test plan must include at least 5 minutes. A recorded budget
  is not a payment, spending authorization, or measured cost.

After submitting, the oldest review remains intact and the new review
becomes another numbered revision. Earlier versions and current status
remain visible. If verified repository identity or selected manifest SHA
changes, the previous review becomes **stale**, requiring an explicit
founder re-review.

## Security and storage

- Additive `migrations/0013_nano_research_founder_reviews.sql` only.
  The ledger is append-only, with unique `(paper_id,version)` and a
  maximum of 25 revisions per candidate, 500 total.
- The new `POST /api/research/review` handler is allowed only after
  **Cloudflare Access verifies the configured founder identity** and
  `HQ_DECISIONS_ENABLED=true`. It checks the exact same-origin `Origin`,
  JSON content type, and explicit `x-hq-founder-action: research-review-v1`.
- Body limited to 1800 bytes; strict enumerations and numeric/text limits;
  source-verified GitHub candidate; exact current manifest SHA.
- An atomic conditional D1 insert checks source metadata, catalog, stored
  evidence, and the founder's expected latest revision. Conflicts return
  409 and ask for refresh, rather than overwriting or performing work.
- The existing read-only agents have no HTTP tools or founder credentials
  with which to call the write action; it is a founder recording capability
  only. There are **no new external requests, API credentials, model calls,
  scheduled jobs or cloud services**.
- Review notes are private. They appear only in the authenticated HQ
  dashboard; no new public API endpoint is exposed.

## Release and verification

Tests: `scripts/test-nano-founder-reviews.mjs`, prior suite, desktop/mobile
browser test with synthetic data and deliberate refused saves.
Before pilot deployment, obtain a D1 Time Travel bookmark; apply **only**
migration 0013 to existing HQ pilot D1, then upload the source preserving
all six bindings and original five-minute Cron.

Do not create a real founder review for a candidate on the owner's behalf.
Real signed-in browser interactions still require the founder's manual
verification.
