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

## V3 — multiple direct revenue pathways (2026-11-21)

The founder explicitly required **opportunity discovery** rather than merely observing outside startup revenues. The Revenue tab must identify workable, evidence-backed ways for YorpHives to earn via advertising, affiliate referrals, partnerships, sponsorships, directly acquired clients, and sales of founder-approved HQventures offerings. Any such recommendation remains advisory and cannot alter the public website, trigger payment setup, or initiate outreach.

### Concrete lanes, evidence and example original sources

- **Ads:** Keep Free Tools free; consider publisher approval and eligible page traffic before testing ads on Free Tools alone. Read the official Google AdSense eligibility/publisher restrictions: https://support.google.com/adsense/answer/9724?hl=en-IN. HQventures, HQ, Home and HQconnect remain ad-free.
- **Affiliate:** Official program pages, e.g. Namecheap https://www.namecheap.com/affiliates/ and DigitalOcean https://www.digitalocean.com/affiliates, are independently sourced **program candidates**, not partner approvals or promised commissions. These providers are *optional external referral destinations* and introduce **no runtime/build/hosting dependency** for YorpHives. Validate visitor intent, availability by country, advertising rules, disclosures, enrollment and current payout terms before applying.
- **Partnerships:** Example official Cloudflare PowerUP partner page https://www.cloudflare.com/partners/power-up-program/. Whether services, leads or commercial referral compensation are available to YorpHives must be checked individually; no assumed referral fee.
- **Sponsorship:** HQ researches public commercial sponsorship discussions and genuine traffic fit; does not add sponsor placements or contact brands on its own.
- **Client acquisition:** HQ reads public Hacker News requests describing a possible software/document/automation project, linking directly to the original item. It requires request-intent keywords, relevant technical work, recent timestamps and multiple corroborating terms. These are **unqualified potential client requests**, *not paying clients or verified active project contracts*. Source comments containing email addresses/phone-like contact details are masked before storage. No unsolicited outreach or automatic lead contact.
- **Paid HQventures products:** Continue customer validation and staged founder approvals. Do not paywall existing Free Tools.

### Scheduled discovery and source health

The existing 5-minute HQ cron drives seven sparse independent read-only public GET windows (UTC):

| UTC | Source | Purpose |
|---|---|---|
| 03:25 | HN public story search | Affiliate program mentions |
| 06:25 | HN public story search | Sponsorship mentions |
| 09:25 | HN public story search | Maker MRR/revenue discussions |
| 12:25 | HN public comment search | Potential client work requests |
| 15:25 | IndieMakerList public XML feed | Outside maker revenue discussions |
| 18:25 | HN public story search | Partner/collaboration discussions |
| 21:25 | HN public story search | Pricing/paid-customer discussions |

Each window remains **at most one public GET**, timeouts, size cap, existing quota, no redirects or forced access, and at most five stored requests for the new monetization lanes (six for existing HN). No new host, secret, cron, cloud resource or external automation service. Results may legitimately be empty. Each source has a visible success/empty/unavailable status. Existing SQLite/D1 opportunities receive only anonymized research evidence with `kind='revenue-client'`, `revenue-affiliate`, `revenue-partnership`, `revenue-sponsorship` (or existing revenue research kinds); no account/lead scraping or emailing.

### Ranking and financial truth

The private Revenue API and simple four-button UI show up to ten ranked channels or specific research leads. Concrete first-party program pages are distinguished from public community chatter, and a client request is not presented as a contract or a qualified prospect. Verified YorpHives income remains `null` without authenticated payment evidence. Outside self-reported earnings never count as company income. All opportunities have original link, risk and the specific manual validation step, with auto-execution disabled.

### Deployment boundary

The latest live HQ baseline was Worker version `6057bd41-ca23-46ae-bc7a-472fa7832a2a`, verified at 100% traffic. The multi-lane upgrade changes bounded public-source collection and the backend query; therefore it is **not eligible for routine auto-deployment** under the installed fail-closed release scope. It needs one additional explicitly founder-approved release. **Subsequent model-only ranking and embedded HQ UI updates auto-deploy after CI**. Do not widen the privilege of the deployed HQ agents merely to avoid this sensitive change gate.

## V4 — Government projects and mandatory 3-question recommendations

Revenue should also look for **government work YorpHives could realistically deliver**: public website projects, digital record management, software, small web applications, automation, dashboards, document workflows, and eligible IT services. This adds a sales opportunity channel, not a separate navigation tab or an autonomous bidding agent.

### First-party procurement sources

- Central Government eProcurement / CPPP: https://eprocure.gov.in/eprocure/app
- Government of Jharkhand eProcurement: https://jharkhandtenders.gov.in/nicgep/app
- Government e-Marketplace (GeM), interactive official bid listings: https://bidplus.gem.gov.in/all-bids

The first two official portals are checked at one **bounded public page check per day**, and only after a respectful robots.txt preflight. Robots disallow, inaccessible robots, 403, redirect, CAPTCHA, unexpected data shape, HTTP errors, or oversized responses produce an unavailable source status and **zero invented tenders**. GeM is link-only/manual: HQ does not use browser tricks or CAPTCHA/proxy bypass to extract bids.

The new windows are 01:25 UTC for CPPP and 23:25 UTC for Jharkhand. The existing seven Revenue research windows are unchanged. Each approved government scan consumes at most two requests (one robots.txt and one public landing page), with 8-second timeouts, manual redirects, bounded response data, the same existing public-fetch budget, and no new binding, service, or site dependency.

### Individual tender verification

A row is accepted only if the official public tender listing contains:
1. A software/website/digital/IT-services scope, not a civil-construction or unrelated goods category.
2. A visible tender reference / procurement identifier.
3. A **future bid-closing date and time**, parsed with explicit Asia/Kolkata (+05:30) timezone and checked against current time.
4. A first-party original portal URL matching the approved official host.

Missing, expired or ambiguous data is excluded. Source-specific rows are deduplicated by tender reference and the information is persisted as **read-only intelligence records** in existing D1 `opportunities.kind='revenue-government'`. No browser/scraper extension, contact harvesting, new HTTP destination, bid registration, or private tender document submission is allowed.

**Important:** An official public tender listing is not proof that YorpHives is eligible or could win, that the tender's scope is feasible, or that a value/EMD/refund/award is known. Tender reference and closing time are shown so the founder can find the original notice and verify all conditions and corrigenda. No bid is recommended for execution until founder review.

### Payer → Why → Next action

Every recommended channel or specific market lead is annotated with:
- **Who might pay?** Potential advertiser, partner, customer, affiliate program, specific tender buyer when present, or *unconfirmed issuing public authority* if not named in the source.
- **Why would they pay?** The actual contract/revenue mechanism being investigated, with unverified buyer need explicitly labeled.
- **What next?** A concrete original-source validation step, not generic encouragement. For tenders, verify reference, issuer, SOW/deliverables, eligibility/experience, digital signature and registrations, closing/corrigenda, EMD/fees/tax, cost and delivery risk before the founder decides whether to bid.

This applies across **Ads, affiliates, partners, potential client services, government procurement, Free Tools sponsorships, and founder-approved HQventures**. All opportunities are still research-only with `revenueVerified:false`, `approvalRequired:true` and `autoExecute:false`. The Revenue page remains inside Home / Health / Products / Revenue, with up to 10 prioritized cards and source/freshness status.

### Governance and release

The three-question display is an eligible routine static UI change in isolation. However, the official tender collector and protected D1 Revenue SQL query change the backend, so this work is **not auto-release eligible**. It is included in the same pending multi-channel candidate following PR #49 and requires **one** manual founder-approved protected HQ workflow run after CI. This is a narrow exception, not permission for HQ agents to change production autonomously; future model-only ranking and UI work remains automatic.

No tender, contract, client budget or government payment is claimed as verified in this initial version. Actual collector reachability and bid completeness must be confirmed from first unattended scans; portal homepages are published first-party links, never fabricated invitations.
