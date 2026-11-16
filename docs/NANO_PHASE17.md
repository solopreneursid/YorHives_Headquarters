# Nano Phase 17 — Evidence-Linked, Manual Experiment Plans

## Goal

Turn Phases 12–16 evidence into an actionable **manual preflight plan**,
without turning HQ into a code executor, deployment agent, purchaser, legal
approver or test runner. This is an evidence-bound *planning* feature.

## What is new

- **Discover → Research journals** and **AI Employees** show a collapsed
  **Phase 17 · Manual experiment plans** panel for each verified public
  GitHub metadata candidate.
- Each plan links to the original paper and the candidate repository; includes
  the selected Phase 14 root-manifest SHA (if observed), Phase 15 dependency
  signals and the current Phase 16 founder decision (if any).
- Ten **preflight verification gates** cover authorship, complete pinned source
  snapshot, direct/transitive dependencies, license rights, model/data/privacy,
  isolated execution environment, hardware, measured cost, independent
  acceptance evidence and **separate founder execution authorization**.
- A root-manifest SHA can be labelled **observed only**, never
  "complete source proven", "reproduced", "ready" or "license cleared".
  All ten actionable *preflight approval* checks remain **unverified**.
- Five **manual stages** specify proof required for progressing from research
  to external founder-led benchmarking, with stop conditions and outcome
  criteria. These contain descriptions, not runnable commands.
- A button **Export manual plan (JSON)** produces a bounded local download
  from the already authenticated report. It does not call a server write route.
  Exports include `executed:false`, `licenseCleared:false`,
  `spendingAuthorized:false` and the list of gates.
- A Phase 16 founder decision of **plan-isolated-test** and a still-current
  manifest may supply **proposed** resource caps. A stale, deferred or absent
  founder decision never provides a usable test cap. No test approval is ever
  implied, even when the plan is current.
- Every numeric actual cost remains unknown until independently measured.
  All checks remain open if the sources are absent or inconsistent.

## Cost, control and governance

- No new D1 migration, write path, GitHub credentials, repository cloning,
  executable commands, arbitrary fetches, paid inference, Cron or API quota.
  The report is purely deterministic from existing D1 rows.
- HQ workers remain permanently observation/research/recommendation only.
- A founder can **record a plan** using Phase 16, but any actual future
  execution requires a **separate, explicit founder decision outside HQ**,
  after a complete legal, technical and operational preflight.
- `yorphives.com` production must never be changed by this release.

## Release gates

1. Tests `scripts/test-nano-experiment-plans.mjs` plus all existing HQ
   source integrity checks pass.
2. Chromium desktop/mobile synthetic report tests verify the accessible
   collapsed cards, ten gates, five stages and local JSON export. No external
   code or real infrastructure is ever tested in CI.
3. Merge Phase 17 into HQ main only when green.
4. Before deployment, compare the current isolated Cloudflare pilot module
   **against the current GitHub main**. If the pilot contains unmerged changes
   (e.g. Growth proxy), preserve and rebase them rather than overwriting.
5. Verify source matching, six inherited Cloudflare bindings, existing
   Access, five-minute Cron, research table counts and independent running
   heartbeat after release.
6. The final signed-in founder-browser experience remains a manual
   verification gate; CI synthetic tests do not imply it was completed.

## What this does NOT establish

No legal right to reuse the research; no verified paper-to-repository authorship
relation; no dependency audit, model/data permissions, GPU suitability,
price estimate, reproducibility proof, approval, execution or revenue.
