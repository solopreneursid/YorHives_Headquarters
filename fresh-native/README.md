# YorpHivesHQ — Native Cloudflare HQ (v2)

Private, single-founder, mobile-first control center with the original supplied YorpHives emblem. New implementation under `fresh-native/` in the existing repository; legacy application and public website are untouched.

## What works

- Six responsive pages: Home, Discover, AI Team, Decisions, Growth, Control; back/forward via hash routing.
- Cloudflare Access founder-only application and independent Worker JWT RS256 enforcement on every data and HTML route.
- Cloudflare D1 persistent opportunities, saved leads, founder decisions, decision history, AI reviews, source performance, quota, and learning weights.
- Five bounded, attributed public research feeds using allowlisted HTTPS GET requests (HN Show/Ask/Pricing/Alternatives, DEV Community). Category assignment is heuristic. All discoveries stay **unverified leads**.
- Cloudflare Workers AI (`@cf/ibm-granite/granite-4.0-h-micro`) only when needed. Reviews are preliminary, capped at **3 calls/account/day by HQ** and 220 output tokens per request; failure degrades to rules-only. Cloudflare Free total neuron allocation is shared with any other applications.
- Deterministic self-evolution: uses founder approve/reject feedback to adjust source priorities after at least three judgments; D1 versioned weights, no model fine-tuning.
- Weekly allowlisted GitHub releases checks suggest software improvements, never install or deploy them.
- Independent Watchdog Worker reads the HQ cron heartbeat from shared D1, checks YorpHives.com, and checks whether anonymous access to HQ is blocked. It does not verify founder login or full HQ functionality and cannot survive a Cloudflare-wide outage.
- Founder-only JSON export of D1 records; no GitHub writer, infrastructure mutation, paid providers, arbitrary web fetch or shell tools in HQ agent runtime.

## Free quotas and scheduling

- HQ cron every 15 minutes: site availability + heartbeat; first-run research then every six hours; optional AI once daily for the latest unreviewed lead; allowed GitHub release checks every Monday 01:00 UTC.
- Research: max 8 scans per UTC day, 5 public HTTP GETs per scan, 15-minute cooldown.
- Workers AI: max 3 HQ calls per UTC day; keep within Cloudflare Free account-wide allocation. Free-tier limits/change remain Cloudflare's responsibility. No guaranteed zero future cost or third-party availability.
- Watchdog cron every 30 minutes. State is recorded in D1 and visible in Control.

## Source building and security

`node build.mjs` checks that `index.html` contains the exact `app.js` script, verifies the original brand logo, and builds `dist/worker.mjs` with an inline-script SHA-256 CSP. The HTML asset is private; both HTML and API require an Access JWT signed by the configured team, audience and founder email. Non-GET API requests require same-origin Origin header.

Do not grant the deployed Worker GitHub, deployment or billing credentials. Founder decisions are **records only**; approvals cannot trigger deployments. Developers may use GitHub/Cloudflare tools separately under founder direction.

## Tests

```sh
node --test tests/*.test.mjs
node build.mjs
node --check dist/worker.mjs
python tests/ui_test.py
```

GitHub Actions additionally tests Chromium, Firefox and WebKit at 320/390/768/1024/1440 px. Local browser tests use simulated API responses and **do not** prove real logged-in Access, Workers AI availability, real external-source retrieval, or scheduled tasks.

## Release and rollback

Deploy a Worker version with the compiled `dist/worker.mjs` and separate D1 binding, Access audience/issuer, and optional AI binding. Deploy the watchdog as a second isolated Worker with D1 only. Do not redirect, merge or delete the legacy HQ until live signed-in, real-source, D1 and cron checks succeed. Cloudflare script version IDs are retained for rollback.

## Remaining production gate

- Authenticate as founder, verify live `/api/bootstrap`, save/decision persistence, JSON export, and AI review output.
- Confirm scheduled production D1 heartbeats, independent watchdog, and successful public-source results.
- Audit mobile behaviour with actual user session; review Cloudflare account usage/billing plan; confirm Free status and AI quota.
- Keep old HQ preserved until explicit release decision.