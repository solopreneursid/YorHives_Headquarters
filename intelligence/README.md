# Product & Growth Intelligence — first implementation

**Status: implementation in a GitHub review branch, not a deployed live agent.** This is an evidence-first read-only product discovery service and frontend module. It is not authorized to edit YorpHives or HQ project directories, create commits, alter infrastructure or deploy products.

## What is implemented

- **Automatic product discovery** from the public YorpHives sitemap(s), top-level tool/product section links and an optional manifest at `/.well-known/yorphives-products.json` or `/products.json`.
- **Automatic monitoring enrollment:** on each successful discovery, a new tool is inserted in an external SQLite inventory and immediately receives an HTTP response check. Future cycles check it automatically.
- **Change observations:** track last check, UI-control fingerprints, HTTP status, repeated failures, additions, reappearances and pages absent from two consecutive complete discoveries.
- **False-alarm protections:** no mass removal when discovery fails or the inventory reaches its safety cap. Two consecutive HTTP failures are needed for a health incident. A 3xx redirect is followed only when it stays on the configured YorpHives origin.
- **Research leads:** fetch owner-configured public RSS/Atom sources for tool and software mentions and compare to known YorpHives product names; classify leads as *potentially missing* or *possibly existing* with limited-confidence scores, not traffic predictions.
- **Competitor watch:** compare **explicitly allowlisted** competitor pages against an enrolled YorpHives product using simple visible-text signals, check robots.txt, and produce *unverified feature hypotheses*, never claims that features work or that our product is inferior.
- **New Headquarters UI:** Product Intelligence screen with discovered catalog, monitoring enrollment indicators, change feed and possible feature gaps. Import `headquarters-report.json` in the existing dashboard.
- **Brand:** the founder's cyan/teal/blue geometric Y logo has been embedded in the HQ styles to avoid any external asset dependency.

The current YorpHives website was not accessible for a live audit from this execution environment, so **no current product list, traffic count, competitor measurement or successful scan is claimed**.

## Installation requirements

Python 3.10+ (no pip packages) and a Linux machine with unrestricted access to **your public website** and optional approved RSS feeds. Hosting, CPU time and internet bandwidth are not guaranteed free, but this component has no subscription or proprietary inference costs.

All writes are confined to `~/.local/state/yorphives-hq` by default. The application refuses to store findings inside its own project directory. Run the service under a separate non-root operating-system account without code-write permissions.

From the **Headquarters repository checkout on the review branch**, run:

```bash
python3 tests/test_intelligence.py
python3 intelligence/run_pipeline.py --base-url https://yorphives.com
```

After a successful run, the private report is written to:

```text
~/.local/state/yorphives-hq/headquarters-report.json
```

In the dashboard, select **Product intelligence → Import scan report** to view the product inventory, discovery changes and growth opportunities. Importing is browser-local. It does not make the frontend a trusted authenticated live dashboard.

To run the collector repeatedly under a founder-managed supervisor:

```bash
python3 intelligence/run_pipeline.py --base-url https://yorphives.com --loop --interval-minutes 60 --research-every 6 --compare-every 24 --browser-discovery --browser-every 6
```

The loop runs YorpHives discovery hourly, public research every six scans, a browser link inventory every six scans, and allowlisted competitor comparison every twenty-four scans. Browser scanning requires an additional local Playwright install: `python3 -m pip install playwright && python3 -m playwright install chromium`. If Playwright is not installed, omit `--browser-discovery --browser-every 6` to run the fully standard-library HTTP collector. This does **not** start a remote server process or schedule itself by virtue of being committed to GitHub. A founder-owned host/service manager must start and supervise it.

## How a newly added tool gets enrolled

1. The founder publishes a new tool on YorpHives.
2. It appears in the public sitemap, under a recognized product path linked from the home/free-tools/explore hub, or in an approved product manifest.
3. The next complete scan recognizes the new same-origin URL.
4. The tool enters the external SQLite inventory; the monitor immediately performs a safe GET health check and records the result.
5. A `new-product` observation is recorded (after the initial baseline); the tool remains in the inventory and is monitored on every subsequent cycle.
6. Visible UI control changes, repeated HTTP errors, and absence across two completed discoveries create review records.
7. Headquarters displays evidence and recommendations. **No AI or detector edits code or performs remediation.**

If the website is rendered exclusively through client-side JavaScript and exposes no server-rendered links, sitemap or manifest, HTTP-only discovery cannot find all tools. An **optional Playwright-based read-only browser adapter is now included**: it observes JavaScript-rendered links without submitting forms or clicking controls. It aborts off-origin requests and mutating methods. A machine-readable manifest is still more complete and scalable, but adding one to the public website requires a separate founder-approved change.

### Optional product manifest (not installed on public website)

When you decide to enable a manifest, publish a JSON document at `https://yorphives.com/.well-known/yorphives-products.json` such as:

```json
{
  "products": [
    {
      "url": "/free-tools/image-compressor",
      "name": "Image Compressor",
      "features": ["Batch compression", "AVIF export"]
    },
    {
      "url": "/explore/new-app",
      "name": "New Application",
      "features": ["Local processing"]
    }
  ]
}
```

The collector accepts arbitrary same-origin URLs from this owner-published manifest, even when an app uses a vanity route not matching `/tools/`. **Declared features are metadata claims**; the dashboard does not treat them as independently tested behavior.

## Opportunity research sources

`intelligence/research_sources.json` is provider-neutral. Its default public feed is `https://hnrss.org/show`. If it is unavailable, research reports the failure; no demand or revenue figures are invented. Feed results are filtered by topic keywords, deduplicated by source URL and ranked using **a capped triage score of at most 45** without independent demand measurements. They are candidates for further validation.

These records are hypotheses:

- `potential-missing-product`: no close title match was seen in the current discovered catalog. The catalog may be incomplete.
- `possible-existing-product`: a title resembles an enrolled YorpHives tool; feature comparison is still needed.

### Competitive feature watchlist

Add a **public competitor page with directly observable product features** into the configuration, after explicitly choosing it for review:

```json
{
  "competitorWatchlist": [
    {
      "name": "Comparison reference",
      "url": "https://example.org/compressor",
      "ourProductUrl": "https://yorphives.com/free-tools/image-compressor",
      "featureSignals": ["AVIF", "batch compression"]
    }
  ]
}
```

The example above is a **format example only**: it is not in the default config and will not run against `example.org`. The process checks the competitor's robots.txt and will only fetch this exact allowlisted page, not attack, log into, or recursively crawl external sites. Only candidate *visible-text differences* are emitted. They must be manually inspected before making any product claims.

## Privacy and security boundaries

- The read-only worker performs safe **GET only**; it never clicks submit, calls mutable APIs, logs into websites, or writes code.
- Observed targets are restricted to the configured same-origin public YorpHives website. Redirects away from that origin are refused.
- External RSS sources and competitor pages are independently specified, HTTPS-only and separately restricted.
- HTML responses are capped at 1 MB; the product inventory is capped at 150 URLs per scan. A cap prevents automatic removal decisions rather than allowing false mass disappearance events.
- Database and report files live outside all project code directories. Keep permissions at least as restrictive as `0700` on the evidence directory and `0600` on reports.
- Production should run with filesystem-level read-only project mounts, no repository write tokens, no deployment credentials, restricted egress, and an independent watchdog.
- The browser dashboard intentionally says **imported/unverified**. For trustworthy live reporting, add founder-authenticated ingestion, signed collector identity, report hashes, freshness checks, and audit trails.

## Important limitations and next milestones

- The core HTTP scanner does not execute JavaScript. The optional browser adapter reads links rendered by JavaScript but does not click through workflows or prove functionality. An HTTP 200 can still serve a broken tool.
- UI controls are surface fingerprints, not proof that a feature works.
- Website status, sitemap completeness and deployment state have not been verified live yet.
- Source matching is heuristic, not a validated assessment of market demand.
- The competitor watchlist starts empty. **No live competitor gaps have been validated.**
- Even the browser adapter cannot discover completely unlinked/unlisted routes. These require an owner-published manifest or explicit inventory feed.
- No persistent server or scheduler has been installed, and no collector is currently running.
- The next production phase should add independent Playwright checks on newly discovered routes, a self-hosted authenticated evidence API, private alerts, and periodic result verification.

## Files

| File | Purpose |
| --- | --- |
| `intelligence/discover.py` | Same-origin tool detection, SQLite inventory, state transitions, health observations |
| `intelligence/browser_discover.py` | Optional safe browser detection of tools rendered by JavaScript |
| `intelligence/research.py` | Public RSS discovery, de-duplication and limited-confidence triage |
| `intelligence/compare.py` | Allowlisted robots-aware text feature comparison |
| `intelligence/run_pipeline.py` | Combines periodic observations into one founder-readable JSON report |
| `intelligence/research_sources.json` | Replaceable data sources and competitor allowlist |
| `tests/test_intelligence.py` | Offline contract tests of enrollment, changes and false-alarm safeguards |
