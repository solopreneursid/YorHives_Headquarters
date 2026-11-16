# Nano Phase 14 — Read-only root manifest and license-file evidence

## Goal

Turn Phase 13's *tentative* GitHub repository candidates into **traceable file evidence**.
Phase 14 does **not** claim that a candidate implements its paper, that its software is safe,
that its licenses permit YorpHives commercialization, or that it will run on free hardware.

## Scope and evidence accuracy

- Candidate eligibility: Phase 12 must first record verified public GitHub repository metadata,
  and the recorded canonical repository URL must match the repository's metadata identity.
  A title-search match remains **not author-verified or paper-linked**.
- First request: GitHub's public API root listing, **not** a clone, recursively downloaded
  source tree, arbitrary link, browser scraper or repository execution.
- Select at most one recognized small root manifest and one recognized small root license
  file, 16 KB maximum each. Known names only: `package.json`, `requirements.txt`,
  `pyproject.toml`, `Cargo.toml`, `go.mod`, `Pipfile`, `environment.yml`,
  `composer.json`, `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `COPYING`.
- Next scans fetch **only the selected public GitHub blob hash**, using its exact 40-hex
  SHA from the listing. Decline changed/malformed, oversize, non-UTF8 or unexpected
  response data. Never silently substitute a moved branch file.
- Persist bounded facts only: path, blob SHA, byte length, and—for `package.json` or
  `requirements.txt`—up to eight *untrusted* top-level dependency-name candidates.
  **No file contents, install scripts, license text, model weights, credentials, or
  remote code are stored or executed.** JSON scripts are ignored, not run.
- A root listing without eligible small files means "no eligible small root files
  observed", **not** that the repository has no dependency/license information.
- License-file *presence* is not license correctness, copyright clearance, compliance
  for dependencies, models or training data, or permission for commercial reuse.
- Names from one manifest are not a full transitive dependency inventory. Hardware
  and running cost remain unknown until independent measurement.

## Cost and security

- Exactly two Phase 14 outbound GET reservations maximum per UTC day, atomic in D1
  under `nano_manifest_fetches`, **also charged** to the existing shared public
  fetch cap. At most one per normal five-minute Cron invocation.
- First eligible repository can bootstrap; subsequent daily windows at 06:45 and
  18:45 UTC; a five-minute follow-up may complete an initial evidence pair.
- Fail closed on HTTP redirects, API errors, invalid response type, unapproved path,
  mismatched file hash or size; conservative cooldown. No OAuth, API key, paid model,
  new cloud Worker, new trigger, arbitrary URL or public write route.
- Additive isolated-D1 migration: `migrations/0012_nano_manifest_evidence.sql`.
  Existing Phase 12/13/journal data stays intact. Evidence is scoped to candidate
  repository URL; stale evidence is hidden on candidate changes.
- HQ worker permissions remain observation/recommendation-only; founder must explicitly
  approve any isolated code execution and any legal/commercial decisions.

## Founder experience

**Discover → Research journals** and **AI Employees** display a new
**Phase 14 · Manifest & license evidence** panel with expandable cards showing
selected filenames, SHA-pinned provenance, incomplete evidence and explicit unknowns.
The report refreshes from D1 as subsequent Cron checks finish.

## Verification and remaining gates

- `scripts/test-nano-manifests.mjs` validates real collector functions against
  synthetic D1 and HTTP fixtures (including hostile URLs, wrong hashes, quota
  exhaustion, source changes and nonexecution).
- Browser integration tests use synthetic evidence at responsive widths.
- Apply migration **only** to the isolated HQ pilot after tests and D1 Time Travel
  bookmark. Verify six original Cloudflare bindings, Access, five-minute Cron
  and production unchanged. Verify real read-only database records afterward.
- An actual authentic signed-in browser session, copyright/legal review, complete
  dependency inventory and isolated reproduction remain separate milestones.
