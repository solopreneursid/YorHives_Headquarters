# Nano Phase 12 — Scientific Implementation Evidence

## Objective

Move beyond scientific-paper titles to bounded, source-linked facts about possible implementation repositories, without pretending that repository presence establishes authorship, legal rights or reproducible code.

## How it works

1. The Phase 11 Scientific Evidence Review supplies research priority, but does not confer trust.
2. A strictly canonical, public arXiv paper URL is visited **read-only**, with a fixed GET, no redirected destinations, 5.5s timeout, strict text/html response validation and a maximum 180 KB response.
3. HTML anchor `href` values are scanned for exact public `https://github.com/OWNER/REPO` URLs. Code from the paper page is NEVER executed. A link is labeled **repository link observed on paper page**; it is not author attribution.
4. When a qualifying link is found, a subsequent scheduled collector call GETs `https://api.github.com/repos/OWNER/REPO` via a strict allowlist, validates the public repository identity and records repository self-description, archived/fork status and GitHub-detected SPDX license *metadata*.
5. **If no GitHub link is observed in arXiv's HTML**, a later Cron check can use the public GitHub repository search endpoint to look for an exact normalized paper-title match in a public repository description. A matching repository is explicitly labeled **title-search candidate — not linked on the paper page or author-confirmed**. This source has no additional quota allocation and no credentials.
6. No license file is parsed and no dependencies, datasets, model weights or code are downloaded. In GitHub's own documentation, API-recognized license metadata does **not** account for dependency licenses or all ways of documenting terms. Even a recognized SPDX identifier is not legal compliance verification.

## Scheduling and free-tier controls

- `nano_implementation_fetches` has an independent atomic **2 requests per UTC day** limit. Each request also consumes the already-existing shared `public_fetches` quota. No new paid service, subscription or API tokens.
- Initially, two previously-unchecked papers can be examined on ordinary five-minute Cron ticks, one per tick. Thereafter, at most one due paper is examined at 04:20 UTC and 16:20 UTC.
- One arXiv page, GitHub search, or GitHub repository GET per scan. Search or metadata follow-ups occur only on later Cron cycles and use the same two daily requests.
- A successful repository metadata check is revisited no sooner than 14 days. A page without a link can receive **one** exact-title GitHub search on a later five-minute tick; thereafter no additional checks occur for at least 7 days. Other unavailable sources follow bounded retry delays.
- Static arXiv and GitHub domains only, no OAuth, endpoint supplied by user, proxy, open redirects, arbitrary upstream links, PDF crawling, scraping restricted data or automated execution.

## Evidence semantics

- `no-repository-link-observed` means *no qualifying GitHub URL was seen in the fetched HTML*, not that implementation code does not exist. Even if the subsequent exact-title GitHub search finds nothing, code may exist elsewhere.
- `repository-link-observed` means a GitHub URL is present on the landing page, not that the paper's authors own it.
- `repository-metadata-checked` means GitHub returned basic public repository metadata after ID validation, **either from a paper-linked repository or an independent title-based repository search**; the evidence record names which route. Neither code functionality nor authorship/provenance is independently assessed.
- The API-reported SPDX license identifier, if any, is metadata *only*, not confirmation of legal suitability or full dependency/model/data licensing.
- Scientific reproducibility, license compliance, source code safety, benchmarks, datasets, weights, model suitability, commercial adoption and real demand remain **not verified**.
- Crossref publications are intentionally not linked to arbitrary DOI publisher websites for code discovery: those external hosts are outside the Phase 12 allowlist.

## Files and testing

- Portable SQLite/D1 migration `migrations/0011_nano_implementation_checks.sql`; all existing journal and science review rows are retained.
- Source-only regression `scripts/test-nano-implementation.mjs` covers strict URL parsing and no dynamic SSRF fetch targets, lossless ledger labels, rate limits, real-looking fake D1, duplicate checks and zero inference or production writes.
- Desktop/mobile browser CI tests the collapsed, scrollable evidence cards.
- Deploy to isolated `yorphives-hq-free-pilot` only after tests and a D1 Time Travel bookmark, preserving six bindings, Access and Cron.

## Future improvements

Search and verify independent implementation links, source file histories, data/model weight licenses, repository dependency chains and reproducible test results *only* through founder-approved isolated execution with hard resource budgets. This phase does not offer automated scientific reproduction.
