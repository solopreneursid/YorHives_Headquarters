# Nano Phase 18 — Founder-Submitted Evidence Gates

## Scope

Phase 18 extends Phase 17's **10 prerequisite gates** with private,
append-only, founder-submitted evidence links and notes.

**Important accuracy distinction:** A submitted URL and founder description
are not the same as source validation, independent QA, verified authorship,
commercial license clearance, a hardware benchmark or approval to execute
code. HQ does not fetch evidence links, rate their credibility or grant
approval. All **10 mandatory preflight gates remain unverified** until
a separate independent, human-controlled process can substantiate them.

## Founder flow

**Discover → Research journals → Phase 18 · Evidence checklist**
(or **AI Employees**):

1. Expand an eligible repository candidate and one of the ten named gates.
2. Review the precise evidence needed and any prior observations.
3. Choose `Needs review`, `Supporting link submitted` or `Potential blocker`.
4. Select the category: research source, code/license, QA, measurement or other.
5. Paste a public **HTTPS** supporting URL without query tokens, fragment,
   embedded credentials or private network addresses, and write a 20–350
   character explanation of what the link **actually supports**.
6. Save as a new numbered founder record. Previous notes remain visible.
   You can replace an incorrect note by appending another revision.
7. When a repository, selected root manifest or founder review revision
   changes, previous gate records are flagged **outdated**. No old notes
   are automatically promoted to newer evidence.

The evidence statuses are *not* approvals. No `verified`, `licensed`,
`ready-to-run`, `paid` or `deployed` state can be selected or written.

## Security and privacy

- Additive isolated D1 migration
  `migrations/0014_nano_experiment_gate_evidence.sql`; `UNIQUE(paper_id,
  gate_key,revision)`, maximum 25 revisions per gate and 600 entries total.
- The new `POST /api/experiment/evidence` is protected by the existing
  Cloudflare Access **founder identity** check and
  `HQ_DECISIONS_ENABLED=true`, exact same-origin `Origin`, a dedicated
  founder-action header, strict JSON, gate/status allowlists, small body
  limits and a public-HTTPS URL parser. All links are text references only;
  **no server fetch** and no screenshots, downloaded files, or raw evidence
  content is stored. Never submit secrets or personal data in notes.
- The D1 append is conditional on the current GitHub candidate, public
  metadata facts, SHA-pinned manifest/catalog, founder review revision and
  previous gate revision, so concurrent edits and stale forms fail closed.
  It never updates or deletes previous ledger entries.
- Submission records are shown only in the authenticated HQ report; external
  link clicks use `noopener noreferrer`.
- HQ workers continue with observation/research/analysis/recommendation-only
  permission. A founder-submitted link is not authority for any employee to
  run a test, spend money, install packages or modify infrastructure.

## Cost, compatibility and release

No new model inference, scheduled jobs, GitHub requests, legal provider,
database vendor or third-party subscription. One short D1 append is made
only on a founder's explicit action. The existing five-minute Cron and
previous research records remain unchanged.

Source security tests: `scripts/test-nano-gate-evidence.mjs` plus all
previous source-integrity checks.

Browser tests: responsive mobile/desktop panels, stale evidence warnings,
history, safe links, refused synthetic writes and no layout overflow.

Release only to the isolated HQ pilot, with a D1 Time Travel bookmark,
strict binding inheritance, six original bindings preserved, and exact
merged-source match for both HQ and Growth modules.

## Still not verified

External source credibility, license permission, dependency rights,
hardware prices, models/datasets and privacy, authenticated founder-browser
E2E and independent execution remain later checkpoints.
