# Phase 11 — Scientific Evidence Reviews

## What HQ does

This phase adds a modular, zero-inference **Scientific evidence reviews** workbench to **Discover → Research journals** and **AI Employees**. The system reads **already-stored** Crossref and arXiv metadata and converts it into transparent research plans, not scientific or business conclusions.

A review contains an original publication link, source type and publication date; a narrow possible YorpHives use; a research-priority rank (0–60, never credibility); relevant *author-reported* methodological keywords; up to two complete sentences from an author-supplied abstract excerpt; a proposed isolated validation experiment; transferability risks; and specific missing-evidence checks.

The original arXiv collector saved up to 450 characters of each abstract. An excerpt cannot establish full methods, successful replication, available source code, licensing, or actual product effectiveness. Crossref may supply only bibliographic metadata.

## Explicit unknowns

No code, weights, datasets, hardware, licensing or independent replications are automatically claimed verified. All remain **not checked** until a future independently evidenced review. No paper is called a proven breakthrough, production-ready tool, or confirmed money-making opportunity. Customer demand, scientific reproducibility, technical feasibility, citations and revenue are marked unverified.

Research review categories: incident/workflow resilience; private AI evaluation; monitoring and anomaly detection; security/privacy; software/automation; general research watch. These are fixed, replaceable classification modules and provide *hypotheses*, not a model-generated expert assessment.

## Free-tier implementation

- A deterministic `nano11Review` transforms existing `nano_journal_papers` rows into JSON review records. **Zero HTTP requests, model calls, PDF retrieval or external services.**
- An additive SQLite/D1 table `nano_science_reviews` stores at most 600 reviews. Original records remain intact and are never deleted.
- The existing five-minute Cloudflare Cron creates at most one review per execution. First three are bootstrapped in normal Cron cycles; then one incremental check is permitted at UTC :05 / :35 to avoid unbounded work.
- Stable input fingerprints prevent rewriting unchanged reviews. Later changes to original bibliographic metadata can trigger a new versioned review without altering founder decisions or published site code.
- The UI displays up to three higher-relevance, distinct-topic reviews as compact collapsed cards. It retains original links, author-sourced excerpts, experimental proposals, risk and evidence gaps.
- No autonomous code execution, purchasing, uploads, deployment, production permissions, outreach or founder-decision mutation.

## Safety

Journal content is treated as **untrusted research data**; all excerpts are HTML-escaped and displayed only as source quotations. Paper content cannot grant instructions to HQ or agents. Only arXiv/Crossref paper links already present in the journal database are accepted. No model-generated recommendations are misrepresented.

## What remains to be developed

A future *code availability* workflow must verify author-linked repositories with separately budgeted first-party requests, review the actual license files, and assess an isolated reproducible test environment **before** claiming implementation availability. A real reproducibility exercise needs the paper's full methods and controlled independent execution. This phase does not perform those tasks.

The recommendations here are research planning prompts requiring founder approval before any action.

## Verification

Run `node scripts/test-nano-science-reviews.mjs` plus existing source-integrity and desktop/mobile browser suites. Apply `migrations/0010_nano_science_reviews.sql` to isolated pilot D1 with Time Travel bookmark before Worker deploy. Then validate preserved counts, actual scheduled science review records, Access, fixed Cron and six unchanged bindings.
