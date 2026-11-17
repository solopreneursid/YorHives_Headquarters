# Phase 19 — Reliability & Production Evidence

## Findings observed before work (17 November 2026)

Cloudflare isolated HQ pilot has six original bindings, five-minute Cron and
an Access-protected dashboard; public YorpHives.com is outside this release.

- The scheduler heartbeat continued to advance and research ingestion remained active.
- One SHA-pinned `pyproject.toml` and a matching LICENSE were collected
  for `mit-han-lab/pear`, but `manifestParser` was still
  `manifest-observed-not-parsed`: the original file was processed before
  the new parser existed. No transitive dependencies or legal rights had
  been assessed. The existing manifest GET budget was 2/2.
- The existing code *already* knows how to backfill old SHA-pinned evidence;
  however a newer partial repository could be selected first and consume
  the strict daily 2 GET quota. A complete file's next normal rescan
  would otherwise be roughly fourteen days out.
- Multiple public tool routes return a generic SPA HTML shell.
  They are **not** demonstrated to function by HTTP GET and cannot be marked
  passed merely because the shell responds.
- Existing browser integration tests use synthetic data; a founder-signed-in
  end-to-end journey remains unverified.
- Cloudflare's Workers AI adapter is present. This is an **on-demand**
  hosted model, not a persistent self-hosted private AI employee.
- Independent GitHub health monitoring checks public website HTTPS and
  an unauthenticated redirect to the private HQ Access gate only.

## Changes

1. **Prioritized safe repair.** `nano14Scheduled` now prioritizes an
   existing SHA-pinned root Python manifest with parser version mismatch
   over newer incomplete repositories. It checks two additional
   UTC windows (00:45 and 12:45) *only when a backfill is queued*.
   All existing inventory windows (06:45 and 18:45) are preserved.
   **The immutable D1-based limit of 2 repository GETs per UTC day and
   shared public-fetch cap remain unchanged**; other sources may consume
   the budget and delay completion. Missing data is never invented.
2. **Founder-friendly operational truth.** The HQ Control page gets a
   single scrollable `Phase 19 · Reliability & readiness` card drawn
   from existing report data only. It shows the observed scheduler
   heartbeat, manually verified repository-candidate counts, observed
   versus parsed manifests, parser-backfill backlog, today's budget,
   newest eligible processing window, founder records and the eight
   remaining workstreams.
3. **No false approvals.** The new report explicitly says the dashboard
   is not production ready, not fully self-hosted, and that scheduler
   freshness is not independent uptime. The card does not claim tool
   functionality, dependency completeness, legal clearance, deployed AI,
   automatic experiments or recovered service.
4. **Tests.** `scripts/test-phase19-reliability.mjs` exercises the
   real PHP-free deterministic JS collector and report with synthetic D1,
   SHA-pinned encoded root file, comments, GPU/robotics names, unchanged
   LICENSE evidence, one daily GET and early window priority. Desktop
   and mobile synthetic browser tests check the real Control card,
   pending-work list and lack of false readiness claims.

## Release boundaries

- Only the isolated HQ pilot is changed. `yorphives.com` production
  is not modified.
- The existing Growth module remains an independent source file.
- Preserve Cloudflare Access and all six script bindings via
  strict binding inheritance; no new secret, Cron, D1 migration or paid service.
- Verify a D1 Time Travel bookmark before release and exact GitHub source
  equality after deployment. Existing paper, manifest, founder and evidence
  rows must be preserved.
- A real signed-in browser journey, actual website tool functionality,
  complete recovery and independent code/asset license audits remain open.

## Operational interpretation

If the new Control card displays one unparsed manifest and a 2/2 request
budget, the next *eligible* backfill slot is not a promise that GitHub can
be fetched: daily source quota, shared quota and source availability apply.
Successful parse completion requires an actual next source collection;
do **not** update an evidence row based on a guessed dependency list.

Eight remaining workstreams (not necessarily eight programming phases):
authenticated E2E; source and rights verification; browser functional
monitoring; recovery/release; private AI; human-authorized experiments;
market/revenue; portable self-hosted runtime.
