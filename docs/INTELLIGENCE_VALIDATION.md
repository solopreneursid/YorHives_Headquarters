# Product Intelligence — validation record (2026-11-14)

## Implemented
- Separate read-only product monitor: public sitemap, tool/product hubs, optional manifest, persistent SQLite inventory, newly discovered tool enrollment, HTTP health status and surface fingerprints.
- False-alarm rules: 2 consecutive failed health checks; 2 complete discovery omissions before declaring a tool no longer discoverable; do not infer removals on failed or capped inventories; browser-only inventory needs fresh browser evidence.
- Optional non-destructive Playwright catalog observer for links rendered by JavaScript.
- Public RSS/Atom research leads, persisted with first/last observation timestamps and confidence limitations.
- Allowlisted, robots-aware competitor page text comparison with source URLs.
- Private `headquarters-report.json` merger and a new Product Intelligence dashboard, with founder's image used as the HQ emblem.

## Verified during this editing session
- The complete updated `dashboard.js` parsed successfully in the available V8 runtime.
- The existing deterministic reviewer (evaluated in an in-memory emulation of its Node file access) reported **0 errors, 0 warnings** on the checked-in HTML, dashboard JavaScript and CSS.
- All hardcoded JavaScript DOM references mapped to HTML IDs, with **0 duplicate IDs** and **0 broken navigation targets**.
- The submitted code updates were accepted by GitHub on the dedicated review branch.

## Not verified / blocked
- No real GET observation against `https://yorphives.com` succeeded from this session. **No real product inventory has been created.**
- Python unit tests in `tests/test_intelligence.py` have been authored but **not executed** in a Python process using the checked-in code.
- The actual Playwright/Chromium browser regression suite has **not executed**.
- No market demand, revenue, competitor functionality or product traffic has been verified.
- No live scheduler, persistent server, private authenticated report ingestion or AI model has been connected.
- Static checks are not a complete security or functional audit.
- No software or credentials were installed on the founder's server, and no running website or production HQ was changed.

## Verification required before deployment
1. On an owner-controlled unprivileged Linux host, clone the **review branch** and run `python3 tests/test_intelligence.py`.
2. Confirm the website exposes discoverable product routes via sitemap/hubs; if client-only, enable the optional browser observer or publish a product manifest through an independently reviewed website change.
3. Run `python3 intelligence/run_pipeline.py --base-url https://yorphives.com` and inspect the scanner-generated `headquarters-report.json` outside the repo.
4. Optionally install Playwright to run the existing browser tests and dynamic catalog discovery.
5. Run one scan before and one scan after a controlled addition of a harmless test tool; verify exactly one `new-product` event and that the route receives a health check automatically.
6. Inspect false-positive and stale-evidence behavior, then connect authenticated evidence delivery and independent monitoring.
7. Keep deployed workers read-only at the operating-system/API permissions level. All findings stay outside source directories.

**Release status: DRAFT. No proof of production readiness.**
