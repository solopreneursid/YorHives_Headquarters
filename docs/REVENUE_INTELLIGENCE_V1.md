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
