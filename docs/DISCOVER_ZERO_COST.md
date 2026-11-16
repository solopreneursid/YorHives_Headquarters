# Zero-additional-cost Discover research system

This system uses the existing Cloudflare Free Worker, existing D1 database and existing 5-minute scheduler. It never enables paid products or paid API endpoints.

## What works now
- Six **deterministic** specialist roles: Product, Technology, Market, Competitor, Revenue and Opportunity Evaluator.
- Public-source collection (Hacker News Firebase with Algolia fallback; DEV Community with HN Search fallback).
- Maximum four HN detail requests per scan, 12 findings per channel, 45-minute D1 cache, one-minute isolate cooldown.
- Results keep original source links, inferred categories, exact observed timestamp and explicit **unverified** evidence status.
- On source outage, serve last successful D1 snapshot as **stale**. If no snapshot exists, show the source directory.
- Background collection occurs at four low-frequency UTC slots/day using the existing scheduler.
- Shortlists are founder-selected; agents do not change repositories, products, HQ files, domains or finances.

## Six roles do not mean six active LLMs
The current six scouts use lightweight keyword matching. Their outputs are labeled rules-based, not AI-generated. Installing a local open-weight LLM requires a founder-owned server or computer running a persistent inference service. No inference is claimed until verified. Inference can later be attached as an optional plug-in under founder control.

## No-cost boundaries
Avoid paid Workers AI, hosted LLMs, external SaaS subscriptions, paid proxying, paid scraping, and new infrastructure. All source access must comply with terms, robots restrictions and per-provider rate limits. Free-tier quotas can cause requests to fail rather than upgrade. Costs of existing domains, hardware, power and internet are not zero.

## Future self-hosted migration
Keep extraction and scoring functions isolated and portable. Mirror observed data in local SQLite when a founder-owned server is ready; only after authentication and sync verification. For optional AI analysis, use a locally served, appropriately licensed open-weight model with event-driven inference and strict founder-controlled read-only tools. Never grant deployed HQ agents website edits, GitHub writes, deployments, credentials or spending ability.
