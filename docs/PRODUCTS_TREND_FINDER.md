# Products: Trending software finder

## Goal
Find software currently attracting public attention so the founder can investigate
building a simpler, differentiated, legal and economically viable YorpHives alternative.

## Founder-facing interface
Exactly one existing Products tab in four-button HQ (Home, Health, Products, Revenue).
Each card: product/source, observed signal, YorpHives improvement, possible monetization,
and a direct original-source link. No additional navigation or autonomous deploy controls.

## Sources (bounded GET-only, one source on its daily UTC slot)
- GitHub: public Search repositories API, recently created and 50+ total stars.
- Hacker News: public Algolia Show HN API, recent posts with 20+ points.
- BetaList: public latest startups HTML listings, if robots.txt allows reading.
- TrustMRR: public newsletter archive links, if robots.txt allows.
- Microlaunch: public product pages under /p/, if robots.txt allows.
- Uneed: public /tool/ listings, if robots.txt allows.
- ARRFounder: public /product/ directory, if robots.txt allows.

The collector checks robots.txt for HTML sites, never bypasses 403/429, never
logs in, and fails closed if content cannot be parsed. Do not treat missing results
as proof a source has no products. No proprietary paid API or paid scraper is needed.
The modular registry may be expanded with explicit validated source definitions.

## Evidence integrity
- `trend-measured`: GitHub total repository stars or Hacker News points/comments.
  These are **attention signals**, not daily growth or product traffic.
- `trend-listed`: presence on a launch directory. No verified visitors or revenue;
  shown as lower-confidence watch items.
- Manual `trend-evidence` and `revenue-trend` records remain visible with their
  source attribution, but are not independently verified by the scanner.
- Cards never assert actual user acquisition, revenue, profits, license clearance,
  or build feasibility from directory listings.
- The recommendation is a hypothesis for founder review, never deployment approval.

## Data flow and safety
The existing single Cloudflare Cron invokes a bounded collector; D1
`opportunities` stores candidates, `status` stores scan outcomes.
The private GET endpoint `/api/trending-products` is protected by the same
Cloudflare Access/JWT middleware as other HQ APIs. The browser uses textContent
for external research data, HTTPS-only source anchors, and noopener links.
Everything is advisory. HQ agents must not modify yorphives.com or deploy code.

## Verification and publication
- `node --check src/hq-worker.mjs`
- `node scripts/verify-current-hq.mjs`
- `node scripts/test-products-trends.mjs`
- `node scripts/test-four-button-browser.mjs` (Playwright, offline mock)
- GitHub Actions verifies Products source and desktop/mobile browser.
- Changes to running HQ use the existing founder-approved manual production
  workflow. No deployment on GitHub push. Only after publication can unattended
  source scans and the protected live endpoint be independently confirmed.

## Expected limitations
Unstructured HTML directory markup may change or a source can disallow
automated access. Do not scrape harder or introduce third-party intermediaries:
mark the source unavailable and fall back to its original source link. Published
revenue on third-party pages may be self-reported, unverified or stale. Verified
traffic requires authorized analytics or independent reliable third-party evidence.
