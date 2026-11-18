# Archived HQ implementation — NOT the live YorpHives Headquarters

> **RETIRED SOURCE (18 November 2026). Do not deploy this repository to the current HQ Worker.**

This public repository contains an **older six-page YorpHives HQ implementation**.
The active, founder-only Headquarters now uses **exactly four sections**:
**Home, Health, Products, Revenue**.

The current working application is deployed separately as the Cloudflare Worker
`yorphives-hq-free-pilot`. Its **verified source recovery snapshots and release
manifest are kept in private, founder-controlled Cloudflare KV storage** rather
than this public repository. A private, version-controlled source repository and
single approved deployment pipeline must be established before calling HQ's
source management production-certified.

## Important security and deployment boundaries

- **Do not run deployment commands from this repository** against the live HQ.
- Nothing here grants agents permission to edit the live website, HQ, repositories,
  infrastructure, credentials, or deployment settings. HQ only observes and recommends.
- Historical CI tests for this implementation do **not** certify the deployed HQ.
- Do **not** upload owner emails, Cloudflare Access credentials, production D1 exports,
  private Worker snapshots, API tokens or other secrets here.
- The independent external HTTPS/Access-gate check, where enabled, is **read-only**
  and does not constitute a signed-in HQ browser check.
- Making this repository private protects future access, but does not revoke copies
  or credentials that may already have been exposed.

## Retirement status

The obsolete Cloudflare Workers `yorphives-hq-control-preview`,
`yorphiveshq-native-preview`, and `yorphiveshq-native-watchdog` were backed up
in private KV, their schedules disabled, and the Workers deleted.
The old Native Preview Access application was retired. The active four-button HQ,
its D1 database, independent perimeter monitor and website watchdog remain in place.

**Founder action needed:** Change this repository to **Private** and **Archive** it
from GitHub repository Settings when ready. That preserves its history without
presenting it as the live deployment source. Any future release should start from
the private verified current Worker snapshot, not `src/hq-worker.mjs` here.
