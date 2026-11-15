# Founder intelligence — free-tier operating design

**Date:** 2026-11-15  
**Scope:** isolated Cloudflare Free Headquarters pilot only. No production website edits, no browsing or uploading customer files, no bot-initiated deployments, no paid model calls.

## Installed light modules

| Office function | Worker strategy | Evidence standard | Founder action |
| --- | --- | --- | --- |
| Website watch | Public HTTP GET every 15 minutes | Reported reachability, not full functionality | Review repeated failures |
| Tool watch | Two oldest/unscanned routes per ordinary 5-minute Cron | Public route response + timestamp; SPA shell means unverified | Review issue before any fix |
| Discovery scout | Sitemap, public links, JSON-LD, optional owner product manifest, bounded SPA strings | Declared sources vs unverified JS candidates | Review catalog completeness |
| Opportunity scout | Limited public Show HN / Ask HN RSS read-only GET | External mention; not demand, profit or traffic | Validate opportunity before building |
| Competitor evidence scout | Two strictly pre-approved official public pages, each sampled daily with robots check | Public advertised claim, never a confirmed YorpHives feature gap | Compare actual functionality yourself |
| Founder briefing | Deterministic summary from private D1 rows, rendered after founder sign-in | Freshness, checked/total counts, provenance and uncertainty | Choose one supported next step |
| In-app alert feed | Existing private monitoring findings / history and briefing | Only evidence from the collector | Open Alerts and verify |
| Public security watch | Small sample of reviewed npm advisories; applicability unverified | Not actual deployed vulnerability inventory | Review against exact package versions |

A displayed 'AI department' is not proof that an LLM agent is running. These modules are lightweight deterministic watchers and recommendations, not deployed autonomous coding workers.

## Free-tier request calculation (UTC day)

- One existing Cron Trigger: every 5 minutes = **288 events/day**, no always-on process.
- Website check every 15 minutes: **96 public GETs/day**.
- Two tool checks per ordinary five-minute event. Six heavier slots (4 discovery, 1 RSS, 1 advisory) and two competitor slots reserve CPU, leaving **280 × 2 = 560 public GETs/day** at maximum configured catalog coverage.
- Discovery: four runs/day, usually around 10–14 public GETs each, approximately **40–56/day**.
- Two research feeds and one advisory fetch: approximately **3/day**.
- Competitor sources: at most two exact URLs with their robots files: **4/day**.
- Approximate expected total at full catalog: **703–719 public GETs/day**, with a shared hard ceiling of **900/day**. It is a request budget, not a Cloudflare billing cap.
- As new tools are published, this fixed-capacity round-robin strategy changes cadence but does not multiply the call budget. 22 tools normally get a first pass within roughly 60 minutes, subject to collector runtime, availability, other work and quota limits.
- Cloudflare Workers Free (as checked in November 2026) allows 10 ms CPU per Cron event, so browser crawlers, model inference and big document parsers are deliberately excluded. This is a constraint, not proof that every event will fit.

Cloudflare is managed infrastructure. Free-tier limits can change; the account owner must check Cloudflare Billing and usage to confirm no payable invoice. Do not enable Workers Paid, Containers, browser bindings or paid AI.

## Public competitor source restrictions

The tiny source registry is embedded in `cloudflare/src/worker.mjs` for the standalone pilot. Only these exact public pages may be fetched:

- `https://ezgif.com/resize` — official public image resizing descriptions, mapped to a discovered image-resizer URL.
- `https://www.ilovepdf.com/help/documentation` — official PDF documentation, mapped to discovered merge/split PDF URLs.

Only fixed `robots.txt` URLs on those same public domains may be fetched as prechecks. Pages are never followed through redirects and are discarded if robots access is denied or unavailable. HTTP or HTML errors yield an **unavailable** status, not a claimed comparison.

The scout looks for a handful of explicit phrases in visible page text. Its recommendation always says **verify whether YorpHives supports this**, rather than claiming the capability is missing or a competitor is superior. No upload, conversion, form, screenshot or functional comparison is performed. No private YorpHives evidence is sent to a competitor.

## Other free/open-source bots reviewed, but NOT installed

**SearXNG** is a self-hostable, provider-neutral metasearch option and would be useful once a founder-owned server exists and the site needs broader global market research. It requires memory, network maintenance and rate-limit infrastructure (the official limiter uses Valkey), so it is not suitable for this tiny Free-tier Worker.

**Crawl4AI** is self-hostable and useful for richer page extraction with a browser, but installing Chromium/Playwright on a persistent host is out of scope and unnecessary for a passive production Headquarters collector. Its browser capability should remain in a separate founder-controlled research environment, not inside website monitoring.

Both are optional future adapters. No paid SaaS, hosted crawler, third-party orchestration intermediary, or persistent open-weight model server is installed.

## Founder briefing semantics

The private `GET /api/report` returns `briefing` with:

- `coverage.discovered`, `checked`, `awaitingFirstCheck`, `checkedPercent`.
- `coverage.httpReachable`, `httpIssue`, `httpUnverified`.
- Main site status from its **recent** HTTP check; old checks become `not-verified`.
- Collector heartbeat freshness, actual open findings, unvalidated research-lead count, confirmed feature-gap count **not** invented, and internal daily usage.
- One next-action suggestion: prioritize urgent findings, then stale monitoring, unchecked tools, incomplete catalog and research review.

The dashboard normalizes each field to small bounded text/numbers and renders via `textContent`; it does not inject source HTML or run external scripts.

## Not implemented / future owner-controlled work

- **External alerts while the browser is closed:** no Telegram, email, push provider or independent off-Cloudflare watcher installed. The private in-app alerts are available only on viewing Headquarters. An external alert requires a separately approved, independently operated endpoint and secret; it must not gain website-write access.
- **Complete product inventory:** until the website publishes an accurate complete manifest, the discovered routes are a partial list; an unlinked SPA may still be absent.
- **Verified features or user demand:** public HTTP GETs and competitor page descriptions do not prove interactive functionality, comparative quality, actual website traffic, revenue or customer demand.
- **Self-hosted private AI employee:** no persistent model server installed; six department labels are organizational, not six running AI models.

The deployed HQ worker remains observation, research, analysis and recommendation only. The founder retains final approval and execution of all website, repository, hosting and deployment changes.
