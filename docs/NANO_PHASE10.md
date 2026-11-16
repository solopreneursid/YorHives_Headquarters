# YorpMind Nano — Phase 10: Research Journals & Scientific Intelligence

Implementation: 16 November 2026. Additive D1/SQLite schema, bounded public metadata fetches, no new paid services.

## Why this exists

The HQ public discovery daily counter (`nano_global_fetches`, three per UTC day) was used by DEV Community, Hugging Face and an OpenAlex query returning HTTP 429. Crossref did not get a chance to fetch. No dedicated journal table or journal UI existed.

Phase 10 creates an **independent academic source budget** and journal feed. It does *not* assert that metadata alone independently validates scientific findings, licensing, user problems or business demand.

## Sources and permitted use

- **Crossref**: Uses supported `query.bibliographic` with `sort=published&order=desc` to prioritize recent publications (not merely recently collected older records). Public REST JSON bibliographic metadata. Reads one **fixed, audited query** each day at most, for artificial intelligence, privacy/cybersecurity, robotics, or software engineering. Stores DOI-linked records and basic publication metadata; Crossref's metadata does not establish reproducibility.
- **arXiv**: Legacy public Atom search feed with max_results=5, rotating among cs.AI, cs.CR, cs.RO and cs.SE. arXiv papers are **preprints** and may not be peer-reviewed. The legacy API rate guide requires at least three seconds between legacy API requests across machines; HQ schedules at most one arXiv request daily.
- **OpenAlex**: Existing global source in cooldown after HTTP 429. Phase 10 does not attempt to circumvent that source's limits and does not automatically obtain keys or buy usage.

HTTP requests use HTTPS fixed allowlisted URLs only, manual redirects (no following), 7-second timeout, 100 KB body limit and strict JSON/Atom parsing. No PDFs, arbitrary article URLs, sign-in, web scraping, provider-issued code, user-supplied endpoints, secret relay or LLM inference.

## Fair resource budget and scheduling

- New atomic D1 counter `nano_journal_fetches`: **two per UTC day**. This is separate from the global 3/day counter. Requests also consume the existing common public-fetch allowance.
- Initial installation bootstraps one academic provider on an ordinary five-minute HQ Cron tick, the other on a subsequent tick, up to that same daily cap.
- Thereafter, the two academic check windows are UTC 02:10 and 14:10. At most one due provider per scheduled tick. Each provider's minimum next check is 24 hours away, respecting bounded HTTP 429 Retry-After cooldowns.
- Two sources, each with one metadata request/day; at most five papers per source per scan; maximum 600 stored paper records.
- A failed request is recorded as unavailable or rate-limited with a next permitted check. No synthetic papers or silent error-to-success conversion.

## Journal feed and analysis

- New UI in **Discover → Research journals**; a secondary Research journals panel also appears in **AI Employees**.
- Source status/last check/next check displayed alongside up to 12 publication cards, a publisher link, publication date, **publication-age label** (within one year / older / unverified), topic, optional *author-provided* abstract excerpt and a safe validation checklist. The original 2021 paper remains preserved as an older publication and is not misrepresented as a fresh discovery.
- Existing database also retains papers and a deterministic research-relevance assessment in `nano_journal_papers`. Relevance scores are **not** confidence, scientific impact or market valuation.
- Four rotating topic areas: AI & agents, cybersecurity & privacy, robotics and software infrastructure.
- Does **not** promote papers into the founder decision queue or claim a technical breakthrough. Scientific reproducibility, code/weights availability, and any commercial application require stronger independent evidence and founder approval.

## Deployment

1. Save a D1 Time Travel bookmark and verify existing record counts.
2. Apply `migrations/0009_nano_research_journals.sql` (new tables and indexes only).
3. Deploy the GitHub Worker to the isolated Cloudflare HQ pilot preserving existing Access/D1/AI/owner bindings, five-minute Cron and disabled background AI.
4. Verify actual D1 source status, at least one first-party paper record where external APIs are reachable, and authenticated browser rendering separately. If an upstream provider cannot be accessed from the Cloudflare runtime, record the error; do not invent journal updates.

## Verification limits

Synthetic CI tests confirm the parser, quota, allowlist, zero-autonomy invariant, and browser UI contract. They do not prove live arXiv/Crossref connectivity. An actual successful scheduled fetch must be observed in the pilot; it is not guaranteed by a passing test.

Reference API policy: https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication
Reference legacy arXiv terms: https://info.arxiv.org/help/api/tou.html
Reference arXiv API usage: https://info.arxiv.org/help/api/user-manual.html
