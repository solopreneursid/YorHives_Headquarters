# YorpHivesHQ Revenue — Founder research dashboard (2026-11-21)

## Purpose

The private Revenue tab recommends site-specific monetization experiments. It is NOT an accounting, billing, or automated marketing tool.

The two business areas are **Free Tools** and **HQventures**. Free Tools must stay free and low-maintenance. Advertising may be considered only on Free Tools after explicit founder approval and applicable publisher approval; Home, HQventures, HQconnect and YorpHivesHQ remain ad-free. HQventures contains only founder-approved products and any paid features must be independently approved. The Support us button remains disabled.

## Screen design

Keep the four existing navigation buttons. Revenue has three compact sections: (1) earnings and evidence, (2) three prioritized YorpHives-specific income hypotheses, (3) linked third-party public revenue research clearly separated from our own earnings.

The prioritized opportunities are: founder-approved HQventures paid products, selective Free Tools ads, and clearly disclosed relevant Free Tools sponsors. Each card states evidence, next founder decision, and costs/risks. No ads, sponsorships, billing, payment collection, external outreach, or production edits are initiated by HQ.

## Evidence

Actual YorpHives earnings remain NOT CONNECTED with amount=null and currency=null; unknown does not mean zero. Verified income must eventually come from a separately founder-approved authentic payout, transaction, or accounting source. No estimates or third-party reported numbers may appear as earned company revenue.

The existing validated public aggregate https://yorphives.com/api/insights/growth may supply browser-reported completed actions, never verified unique visitors, ad impressions, conversions, or money. If unavailable, the dashboard states that it is unavailable. Unverified outside revenue headlines are sourced only from existing D1 rows of kind revenue-trend, linked to their original report, and never added to company earnings.

## Architecture and permissions

The GET /api/revenue-intelligence endpoint is protected by existing private Cloudflare Access and Worker JWT checks. It reads the current D1 research rows and, where available, the existing bounded growth aggregate. The pure module src/revenue-intelligence.mjs performs no network calls or writes. No new database tables, subscriptions, secrets, scheduled jobs, providers, or permissions are added.

The deployed HQ remains strictly observation / research / recommendation only; founder is the executor of actual product, site, payments and AdSense changes.

## Verification and release

Run node scripts/test-revenue-intelligence.mjs, node scripts/verify-current-hq.mjs, the source-integrity and Products checks, and the mock Chromium mobile/desktop suite. Production baseline is Worker version 319b26ea-a4ca-4695-8c1e-e565105c69eb with six modules. The Revenue candidate has seven modules and must pass the existing separate protected workflow_dispatch and hq-production environment review. Browser acceptance while signed in is still separate.

## Future validation

Before execution, obtain reliable traffic / permitted ad impressions for Free Tools and confirmed customer demand / price acceptance for HQventures. Paid integrations and any analytics/financial connection require explicit founder approval. No estimated RPM, profit or subscriber counts without defensible evidence.

## V2 — continuous research intelligence candidate (2026-11-21)

### Data sources and attribution

An isolated portable `src/revenue-research.mjs` module uses three explicit public GET windows on the **existing** 5-minute scheduler. It has no own independent scheduler, API keys or external agent communication:

1. 09:25 UTC — HN Algolia public API, dated stories mentioning maker revenue, MRR, paid users, subscription or related evidence.
2. 15:25 UTC — published IndieMakerList `/feed.xml`. Only RSS/Atom entries with dated, matching titles and valid original links on that publisher's domain can qualify. This publisher says its public maker data is CC BY 4.0 and openly sourced; only short attributed titles and links are retained.
3. 21:25 UTC — HN Algolia public API, dated pricing, paid customer and startup monetization conversations.

Each run uses the existing shared public-fetch quota, **one** allowlisted HTTPS request, 8-second timeout, manual redirect prevention, 96kB response cap, 20 search hits or 50 feed entries examined, and **at most six** persisted evidence items. No bypass of robots/access restrictions and no paid proxy. Host, path and protocol are hardcoded. Public HN engagement thresholds are at least five points and two comments, restricted/irrelevant items are excluded, and no old or undated items are treated as fresh. Feed entries may legitimately produce no candidates; failures are recorded as unavailable instead of inventing data.

Evidence is stored in existing D1 `opportunities` using `kind='revenue-research'`, while `status` holds per-source checks. The 21:25 UTC maintenance path removes **only** these research records older than 120 days, never unrelated Products or founder records. Stored outside-source claims are never called verified customer revenue.

### Ranking and actionable recommendations

The deterministic `src/revenue-intelligence.mjs` model combines existing founder business channel hypotheses with qualified current research rows. It uses a simple market-fit heuristic for GovRadar jobseeker workflows, Free Tools niches (PDF/image/file/browser) and HQventures app/agent workflows; unclassified outside ideas remain in Market Revenue Intelligence rather than being pushed as YorpHives launches.

The API returns **up to 10** ranked opportunities, with at most seven sourced additional candidates, three per business category and five per outside source type. It may show fewer until independently retrieved evidence meets the eligibility filter. A score is an investigation heuristic, not a financial forecast. Each sourced candidate includes date, original link, speculative buyer, next founder validation, rough effort and risk. Source statuses show last scan and public access failures. `verifiedEarnings.available` stays false and `amount` stays null; buyer demand, ad impressions, revenue and traffic are never inferred from HN votes or outside maker statements.

The Revenue UI keeps exactly the four established tabs and now consists of **Earnings & evidence**, **Top Revenue Opportunities**, **Market Revenue Intelligence**, and **Research sources & freshness** within the Revenue tab. No signup or UI controls perform monetization or send external transactions. The site's existing Support us feature remains disabled; no ads are added outside Free Tools.

### Tests, boundaries, release

`scripts/test-revenue-research.mjs` checks source parsing, freshness, unverified claims, three daily scan windows, GET-only behaviour, D1 evidence-only writes, allowed retention, fetch budget failures, and ranked opportunity limits. Run it with `scripts/test-revenue-intelligence.mjs`, the exact-source integrity checker, Products regression, and mocked mobile/desktop browser regression. No production credentials or real authenticated browser session are used in CI.

Live seven-module baseline: `2536fdf8-450c-47c9-8ef3-a84e1081ac96`. The eight-module candidate requires the manual `workflow_dispatch` protected `hq-production` environment review; Git merge cannot publish it. After approval, the first successful scan happens at the next scheduled UTC slot, not immediately. No promises that the publisher feed is currently accessible or that genuine new revenue reports will be found on every scan.

## Revenue quality review — 2026-11-21 10:10 IST

The founder's first post-release Revenue screen was reviewed against stored source and scheduled-check evidence. Three `revenue_research_*` statuses were all `not-yet-checked`, expected before the first scheduled 09:25 UTC / 14:55 IST public research window. This is not proof that any source is reachable or that the next run will record credible leads.

The initial model displayed the same unverified **Glowy** outside revenue claim in both the ranked Top Opportunities and the Market Intelligence list; it also automatically treated a purported AI image-credits business as a low/medium-complexity Free Tools advertising candidate. Both are unsupported leaps.

The corrected logic leaves unverified third-party revenue figures in **Market Revenue Intelligence** only, until meaningful independent customer and operating-cost evidence justifies founder investigation. Research discussion leads may be promoted into Top Opportunities as speculative validation experiments but, once promoted, are excluded from the redundant Market list. An AI photo generation/paid credits product is evaluated as a possible HQventures product with *high, unverified inference costs*; ordinary private PDF/image editing may still be appropriate for Free Tools.

No change to collectors, scheduling, source restrictions, website monetization, cash accounting, founder permissions or existing production configuration. This correction requires the same manual founder-approved HQ release; current live eight-module version is `efdb1d2a-2d56-4a4f-89c2-8505fa4dfa1c`.
