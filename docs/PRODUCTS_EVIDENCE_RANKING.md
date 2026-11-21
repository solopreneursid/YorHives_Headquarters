# Products Intelligence — Evidence-first ranking (release candidate, 2026-11-21)

## Founder-facing behavior

The Products tab keeps the existing four-button HQ navigation. Its landing view presents the 10 highest-ranked candidates; up to 20 more remain available behind an expandable **More research candidates** disclosure, without adding navigation. It shows product names, the original public source link, dated evidence, a proposed narrow improvement, and a non-promissory revenue experiment. A second disclosure lists product URLs independently found in permitted public launch feeds; these entries stay explicitly `link-only-unverified`.

If stored records attach two different titles to the same Hacker News discussion ID, neither title is ranked against those discussion points. The conflicting records are quarantined from recommendations pending source verification; previously discovered public URLs stay in the separately labeled link-only area. This handles evidence inconsistency without mutating historical database records.

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

## Discovery efficiency and business-quality gates (next candidate, 2026-11-21)

The collector keeps its existing independent 30-minute public intelligence opportunity within the 5-minute HQ scheduler. It selects from up to 90 due sources and processes **one source per eligible run**, preserving API/fetch budgets. Productive seed feeds are considered first; automatically discovered GitHub topics are exploratory, with higher priority only when relevant to user-facing applications and they produce results. New unrelated vendor-language and SDK topics are not continually promoted into the scan queue. Existing sources and historical records remain intact.

After a successful scan, seeded sources are checked again at most every 24 hours, focused auto-discovered topics at 48 hours, and unrelated exploratory topics at 120 hours. Empty public listings back off for 72 hours, other failures 48 hours, too-large API responses 72 hours, and robots-disallowed sources 168 hours. These intervals are conservative cost limits, not uptime or availability guarantees. The Firefox search response page size is reduced from five to three to respect the read-size limit. Restricted sources are **not bypassed**.

An increase between two days remains early evidence only. Tiny increases that fail both significant absolute and relative growth cutoffs are ranked below meaningful early movement; 3+ observations and rising intervals are still required to label sustained momentum. A GitHub SDK or curated link collection is treated as a technical reference, not an independently launchable product. Product-specific commercial hypotheses include the likely customer, narrow MVP, possible revenue experiment and rough build effort. Demand, customers, traffic, revenue, costs and code-license clearance remain **unverified**; the model cannot approve a new business.

## Release boundary

The prior Products release is live and GitHub/manual-release verified: `yorphives-hq-free-pilot` version `de401248-ba02-42b7-8cd1-cc3de55a0f78`, six modules. The **next candidate** adds source-quality cadence and commercial hypothesis improvements in the same modular files. Its source SHAs are pinned separately. Manual release checks current live six-module source, bindings and schedule before uploading candidate code. No continuous deployment is introduced.

GitHub Actions may run read-only CI on a PR; production remains behind a separate founder-authorized, manual-only `hq-production` environment. Cloudflare Access and the HQ agent's observation/research/recommendation-only authority remain unchanged. Unauthenticated access and signed-in browser checks are separate release acceptance gates. Production live source and D1 data remain untouched by this PR.

## Automated checks

`node scripts/verify-current-hq.mjs`, `node scripts/test-products-trends.mjs` and `node scripts/test-products-evidence.mjs`. Browser integration should be rerun at normal release review. After founder-approved deployment, check the private `/api/trending-products` payload for `schemaVersion: 2`, evidence grades, fallbacks and source statuses. Check the 24-hour seed source revisit behavior, HN conflict quarantine, and `commercialFit`/`buyerDemandVerified`/`licenseVerified` fields; verified demand and revenue should remain `false`.
