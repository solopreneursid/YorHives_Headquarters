# YorpMind Nano — Phase 6: Source-specific investigations

## Objective
Autonomously investigate public research entries at zero additional cost without converting platform metadata into claims about demand, revenue, product features or licensing suitability.

## Source restrictions
- Investigations operate on already-stored HQ `nano_memories`. No user-supplied URL is fetched.
- Recognized sources: an exact GitHub repository page or a Hacker News item URL.
- Hacker News investigation reads the same item from the first-party Firebase API. If the item links directly to a GitHub repository, it may read the GitHub repository API as a **second platform**.
- GitHub investigation reads GitHub's first-party repository API. Repository data establishes that the repository exists and reports its own metadata, not independently validated functionality.
- All other domains are recorded as **unsupported-source**, with no external request. Safe-domain expansion requires code review, explicit origin allowlists and a fetch budget.

## Data and processing
- `nano_investigations` is a bounded one-row-per-memory D1/SQLite ledger. It includes platform sources, capped metadata summaries, department-specific research questions, simple status codes, timestamps and a source fingerprint.
- On an empty investigation ledger, the next five-minute Cron bootstraps one opportunity memory. Thereafter, every half hour at UTC minute 20 or 50, the existing Cron selects at most one due memory. Recheck is no earlier than three days after normal metadata checks, or 24 hours after a temporary unavailable source.
- **At most four outgoing investigation fetches per UTC day**, enforced with atomic D1 quotas, shared public-fetch budgeting, bounded response size (45 KB), a four-second timeout, redirect following disabled using Cloudflare-compatible `redirect: 'manual'` and rejection of 3xx status, and no credentials.
- The scheduler makes zero LLM calls, zero deployments, no site writes and no purchase/payment calls.
- A reviewable "Research investigations" card in AI Employees shows public metadata, optional cross-platform evidence, clear limitations and department questions. The existing priority shortlist remains evidence-gated. No investigation result automatically becomes a founder decision.

## Verification scope
- First-party API response checks only: not independent customer research, revenue verification, software execution, code audit, functional testing, or license compliance.
- HN discussion counts and GitHub stars/forks are unverified public engagement counters; do not label them market validation.
- Cross-platform status is only possible if an HN story links to an exact GitHub repository and both first-party API records succeed. Even then, product functionality and customer willingness to pay are unverified.
- The existing six departments receive question templates rather than model-generated judgments. Real independent departmental AI inference is not claimed.

## Deployment
1. Back up or bookmark the isolated pilot D1 database.
2. Apply `migrations/0006_nano_investigations.sql`.
3. Deploy the updated Worker to the existing isolated HQ pilot retaining its six current bindings and five-minute Cron.
4. Verify browser tests, source-integrity tests and real D1 scheduler records. The first supported-source inquiry is only expected at UTC minute 20 or 50, under the daily fetch cap.

## Next steps
Integrate legally permitted, domain-reviewed corroboration providers for stronger evidence, a source-provenance graph, explicit re-check budgets and truly independent customer-problem validation. Never automatically change the main YorpHives.com deployment or HQ infrastructure.
