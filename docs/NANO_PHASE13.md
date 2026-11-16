# Nano Phase 13 — Implementation Feasibility Triage

## Status / intention

Phase 13 is a **first-pass, evidence-limited review**, not a technical audit or a license determination.
It consumes Phase 12's already collected, first-party GitHub metadata and derives a cautious,
transparent feasibility checklist with **zero additional HTTP, model inference, D1 tables,
secrets, scheduled triggers or infrastructure subscription cost**.

The Phase 12 exact-title GitHub result for PEAR is a **candidate**, not an arXiv-linked or
author-verified implementation. A detected Apache-2.0 SPDX ID on the repository is not
verification of legal suitability, dependency terms or rights to datasets/model weights.
Training and simulation signals suggest potential GPU expenditure but cannot prove resource needs.

## What the Phase 13 dashboard displays

The **Discover → Research journals** and **AI Employees** pages show a new
**Phase 13 · Implementation feasibility** panel (collapsed source-linked cards):

- Repository identity and paper relationship: whether GitHub metadata matches the candidate URL;
  explicit warning for exact-title search matches. **No authorship verification.**
- License: GitHub-reported SPDX identifier or missing metadata. **Always human review required.**
- Dependencies: **not inspected**, including direct/transitive package licenses,
  datasets, weights and external APIs.
- Hardware: **unknown** by default; a title/description mention of training, GPUs, simulation,
  robotics, reinforcement learning or large models triggers **possible cost risk**.
  These are keyword indicators, not a benchmark or a cost estimate.
- Proposed next steps: founder-reviewed provenance, license, dependencies, data/weight rights,
  hardware budget and an eventual isolated reproducibility plan.
- A conservative **defer/manual review/insufficient evidence** disposition; **never approved**.

Every review is recalculated from persisted Phase 12 data on existing authenticated dashboard
reads; when Phase 12 adds or updates evidence, the displayed review updates without another Cron.

## Explicitly not implemented or verified

No repository files, manifests, lockfiles, model weights or datasets were downloaded or
inspected. No external code was executed, tests were reproduced, maintainers contacted,
commercial reuse cleared, hardware bought or paid compute started.
**A confirmed dependency inventory and measured cost cannot be produced from Phase 12
metadata alone.** Follow-on work must use bounded, source-verified read-only manifest
inspection, then separately founder-approved isolated tests with hard CPU/RAM/GPU/time limits.

## Safety / test conditions

- No access to production code, GitHub write actions, changes to YorpHives.com or
  autonomous deployment. HQ remains observation/recommendation only.
- Existing Access auth, six bindings, five-minute Cron and Phase 12 quota unchanged.
- All external links are constrained to the existing canonical arXiv/GitHub validators.
- New tests: `scripts/test-nano-feasibility.mjs` (source-integrity CI).
- Publish only to the isolated HQ pilot after tests pass and verify unchanged bindings/
  Access, authentication, D1 integrity and UI with an actual browser.

## Next phase boundary

A subsequent **evidence-gathering** improvement may fetch a narrowly allowlisted,
bounded set of repository manifests **read-only** with explicit quotas, record SHA-pinned
provenance and license limitations, and mark hardware figures 'unknown' until measured.
An isolated code run requires the founder's separate authorization; it is not part
of this assessment.
