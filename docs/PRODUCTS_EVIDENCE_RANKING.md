# Products Intelligence — Evidence-first ranking (release candidate, 2026-11-21)

## Founder-facing behavior

The Products tab keeps the existing four-button HQ navigation. It shows product names, the original public source link, dated evidence, a proposed narrow improvement, and a non-promissory revenue experiment. A second disclosure lists product URLs independently found in permitted public launch feeds; these entries stay explicitly `link-only-unverified`.

Sources that disallow automated access are **not bypassed**. Their original directory URL and last public-check status remain visible. A site returning an empty public listing does not count as a successful product discovery. The fallback is to use separate public feeds/APIs that permit collection, never to attribute a substitute lead to a restricted source.

## Ranking policy

* **One public listing** — unverified attention, low priority.
* **One dated metric** — raw popularity snapshot, growth **not measured**.
* **Two dated metrics** — early movement; require more observations before treating it as sustained.
* **Three or more dated metrics across at least two UTC days, with at least two rising intervals and meaningful daily absolute and percentage increases** — repeated growth signal, still only a public proxy. GitHub: ≥10 stars/day and ≥3%/day; HN: ≥12 points/day and ≥20%/day; Mozilla: ≥25 daily users/day and ≥5%/day; npm: ≥200 rolling weekly downloads/day and ≥20%/day. These are investigation heuristics, not empirical estimates of market demand.
* Flat/falling metrics are marked as such. A 7-day freshness penalty and source-family caps prevent stale or same-source results from monopolizing the page.
* GitHub stars, Hacker News points, Mozilla daily add-on users, and npm rolling downloads are never portrayed as independently verified visitors, revenue, profit, or launch approval.
* Priority scores are deterministic **investigation rankings**, not forecasts.
* Business suggestions are hypotheses to investigate; any independent build must respect original licenses, branding and user rights.

The implementation works on plain result rows and stays portable between D1 and SQLite. The read-only endpoint uses bounded query sizes (250 opportunity rows, 2,500 dated metrics, 20 link-only leads). No paid API, headless-browser evasion, new secrets, third-party agent network, remote code execution, or auto-deployment capability is introduced.

## Release boundary

The branch is a **candidate only**. Baseline live Worker: `yorphives-hq-free-pilot`, version `8ef0a04b-645a-4a9e-aa39-a95b0b1700d2`, five modules. Candidate: six modules with an isolated `products-ranker.mjs` and an updated private Products UI. Source SHA locks and release preflight must match the existing live five-module baseline before uploading the candidate.

GitHub Actions may run read-only CI on a PR; production remains behind a separate founder-authorized, manual-only `hq-production` environment. Cloudflare Access and the HQ agent's observation/research/recommendation-only authority remain unchanged. Unauthenticated access and signed-in browser checks are separate release acceptance gates. Production live source and D1 data remain untouched by this PR.

## Automated checks

`node scripts/verify-current-hq.mjs`, `node scripts/test-products-trends.mjs` and `node scripts/test-products-evidence.mjs`. Browser integration should be rerun at normal release review. After founder-approved deployment, check the private `/api/trending-products` payload for `schemaVersion: 2`, evidence grades, fallbacks and source statuses.
