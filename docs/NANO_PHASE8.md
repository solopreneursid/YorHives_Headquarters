# YorpMind Nano — Phase 8: Source Reliability and Research Quality

Implementation date: 16 November 2026. Pilot only. The deployed HQ cannot execute production changes or make autonomous founder decisions.

## Objective
Reduce noisy leads and unavailable-source alerts while preserving traceability and strict free-tier budgets.

### 1. Rate-limit-aware source health
- The existing OpenAlex source returned HTTP 429 on 2026-11-16. OpenAlex documents small anonymous budgets, free verified-email keys, 429 daily/rate thresholds, and the Retry-After header. No key is automatically registered: the pilot stays keyless.
- `nano7Fetch` records the exact non-200 response status and optional Retry-After header (it never follows redirects).
- `nano8RetryDelay` calculates a bounded cooldown: at least the provider's valid Retry-After window, 12-hour exponential steps up to 7 days on repeated 429s, and a hard 30-day ceiling.
- Existing `nano_source_scans` records retain their schema and complete historical `checked_at` and `next_check_at`. The UI maps an existing HTTP 429 detail to **Rate-limited** and displays its next permitted retry time. Other errors show **Source unavailable**.
- A due check cannot fetch again while the existing source's `next_check_at` is in the future. Free-tier Cron still runs every five minutes but does not use external requests on cooldown.

### 2. Academic alternative provider
- The direct public Crossref REST API becomes a fourth provider in the same declarative registry with a literal GET URL, fixed `query.title` and `rows` values, and an exact DOI link allowlist.
- Crossref supports anonymous public metadata queries and publishes rate/concurrency limits. No API key, new subscription or account is introduced.
- It shares the existing **three global source requests per UTC day** with DEV Community, Hugging Face, and OpenAlex. There is *no fourth paid request*. A newly registered provider can be attempted on a later UTC day when the quota is available; it does not bypass rate-limit rules.
- Scholarly titles, DOIs and citation counts are *publication metadata*. They are not validation of scientific claims or commercial demand.

### 3. Research quality filtering
- Deterministic `nano8Quality` tags each source lead as `candidate`, `monitor`, or `filtered` with a short explanation and rubric version `source-quality-v1`.
- Publicity, award winners, giveaways, roundups and similar announcements are **still retained** in the source ledger but **not newly inserted into the business opportunities workflow**.
- Among the maximum eight received listing records, the two highest priority items are selected. This avoids wasting a fixed two-item quota on announcements when concrete problems are also present. Lower-ranked items not selected are not stored.
- Developer problem/implementation posts may be candidates for investigation; model pages and papers remain watch-only pending safety, license, performance and independent validation.
- The same rules apply to existing legacy D1 source leads at report time. Nothing is silently deleted. Already-recorded opportunities and founder decisions are preserved.
- All leads remain unverified; a candidate grade is priority for additional research, not business viability, technical compatibility or independent customer validation.

### 4. Cross-source signal checks
- `nano8TopicSignals` compares distinctive title tokens between records from **different** publishers and excludes generic buzzwords and model identifiers.
- At least two distinctive terms must overlap. Results are labeled *unverified cross-source topic overlap*, and must never be presented as corroborated factual claims, demand, revenue, or functionality.
- Existing Phase 5 founder-review threshold and approval controls are not relaxed.

### 5. Operational and cost safeguards
- No new D1 tables, HTTP credentials, model calls, vendor subscriptions, deployments by agents, or SaaS intermediaries.
- Existing rate limit and daily request quotas remain mandatory.
- Fixed allowlisted provider endpoints; only strict canonical DEV, Hugging Face, OpenAlex or Crossref listing links are recorded.
- Automated regression tests include UI responsiveness, Crossref normalization, provider rate limits, Retry-After/backoff, filtered lead provenance, absence of unapproved source requests and transparent uncertainty.

## Verification boundary
Synthetic tests validate API-contract behavior, not real Crossref reachability. A successful live Crossref query and actual OpenAlex retry response remain separate observations after deployment. If Crossref responds unavailable, HQ must record the error rather than report success.

## Source documentation
- OpenAlex authentication and rate limits: https://help.openalex.org/api/authentication/
- OpenAlex error handling: https://help.openalex.org/api/errors/
- Crossref REST access and limits: https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/

## Next step
Collect source-topic provenance over multiple independent providers, then introduce genuine evidence-based opportunity reviews using validated customer problems and founder-approved learning. No automatic site changes or claims of AI-only independent verification.
