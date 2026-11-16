# HQ Growth Intelligence — first-party, read-only integration

HQ Growth now fetches `GET /api/growth-evidence`, an Access-protected HQ endpoint that performs exactly one bounded anonymous HTTPS GET to `https://yorphives.com/api/insights/growth`.

## Boundaries
- Website source is a fixed, allowlisted origin. HQ cannot select a URL, send commands or credentials to YorpHives, write site data, deploy software, or approve product launches.
- Existing Access verification precedes the HQ endpoint; only GET is allowed. There are no new database writes, Cron triggers, secrets or binding changes.
- The upstream result is validated for a 30-day consecutive UTC series, nonnegative integer counts, published-style paths, at most 10 ranked products and five investigation signals. Invalid/stale/unavailable upstream returns unavailable rather than made-up figures.
- Reports contain aggregated browser-reported actions, not unique human visitors, proven conversions, verified demand or revenue. Earnings remain explicitly unavailable.
- HQ Growth displays seven-day comparisons, daily counts, indicative product rankings and research signals requiring founder review.
- The HTML is escaped; product links are strictly relative tool/app/product paths under the official site.
- The adapter has a 4.5-second deadline, 64 KB response cap, no redirects, and no automatic periodic external scanning. A Growth page load/refresh reads the proxy; repeat calls are limited by the 120-second client refresh window.
- The existing source-integrity workflow runs `scripts/test-growth-evidence.mjs`.

## Release verification
1. Confirm Worker syntax, embedded dashboard syntax, and the entire source-integrity suite including growth tests pass.
2. Deploy only to the isolated HQ pilot first, retaining existing Access, D1, AI budget and Cron bindings.
3. Sign in, open Growth directly and through the nav, verify it renders the same aggregate totals as the live public endpoint and shows **Unavailable** on transient failures.
4. Confirm no HQ request causes a write to the website, and that an unauthenticated request to `/api/growth-evidence` fails closed.
5. Only after founder-approved review, promote the tested HQ build. No website code or production website release is required.
