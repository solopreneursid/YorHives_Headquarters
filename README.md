# YorpHives HQ — Current Private Source of Truth

**Current application: Home · Health · Products · Revenue.**

This private repository now contains the **exact four-module source** recovered from the running
`yorphives-hq-free-pilot` Cloudflare Worker (verified on 18 November 2026). The old
six-page HQpulse implementation is **retired** and must not be deployed. Its commits remain
available in Git history for investigation, not as production source.

## Responsibilities (read only)

- **Home:** concise status across Health, Products and Revenue.
- **Health:** monitoring, bugs, broken links, dependency vulnerabilities, evidence and recommended fixes.
- **Products:** internet/open-source discovery, evaluation and proposed integrations.
- **Revenue:** research and recommendations; never pretend projections are verified earnings.

Deployed HQ workers and AI agents are **observation, research, analysis and recommendation only**.
They may not change the website or HQ source, deploy, pay, or mutate infrastructure.
The founder is the sole production release approver.

## Ownership and deployment

- The source of truth is `src/{hq-worker,growth-evidence,watchdog-evidence,agent-demand-evidence}.mjs`.
- `hq-release.json` pins the source Git blobs, expected Cloudflare bindings, schedule and last verified version.
- Run `node scripts/verify-current-hq.mjs` and the GitHub Actions browser smoke workflow.
- New deployments must be **manual only** via the dedicated, founder-approved
  `HQ production release (manual)` GitHub Action, after CI passes and a production
  environment review. No push or merge deploys anything automatically.
- The live Worker remains `yorphives-hq-free-pilot` protected by Cloudflare Access.
- `ACCESS_OWNER_EMAIL` and all other binding **values** are intentionally absent from this repo.
  The release adapter must read and preserve current bindings, refusing changed binding names/types.
- Before use, founder must configure an **environment approval rule** for `hq-production`,
  register narrow read/write Worker release credentials in GitHub environment secrets and
  reduce/revoke broad legacy Cloudflare tokens. A manifest is not an API permission lock.
- A verified current-source backup and release lock are also retained in private Cloudflare KV;
  those backups are independent of this repository.

## Tests and scope

`node scripts/verify-current-hq.mjs` checks the four pages, embedded frontend syntax,
required Health/Products endpoints, module integrity, authentication guard and binding inventory.
`scripts/test-four-button-browser.mjs` uses local mocked data to exercise the four pages
in Chromium (desktop/mobile) without production credentials or writes.
**Only** the signed-in browser's "Verify signed-in session" button checks a real
founder-authenticated HQ API, collector and database. That self-test is not
unattended authenticated uptime monitoring.

## Historical content

Older `docs/NANO_PHASE*`, old migrations and old `scripts/test-nano-*` files
describe previous builds and are **not release inputs**. They remain available
for audit/history until separately purged by the founder. Do not execute old tests
as deployment gates or merge old changes into this current source.

## Privacy and safety

Do not commit Cloudflare API tokens, password values, owner identity details,
D1 dumps or access cookies. GitHub repository visibility must remain **private**.
Avoid pushing a source snapshot to any public website repository.
