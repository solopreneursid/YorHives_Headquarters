# Independent Website Monitoring — HQ Read-Only Integration

## Architecture

YorpHives Edge Watchdog is a separate Cloudflare Worker (`yorphives-edge-watchdog`) which runs its own scheduled checks every 15 minutes and records short-lived reports in a **dedicated KV namespace that HQ cannot access**.

YorpHives HQ has one direct **service binding** named `EDGE_WATCHDOG` to that first-party Worker, not a third-party proxy or an MCP service. The binding permits requesting the watchdog's **read-only** `GET /status` and `GET /history` API; the watchdog itself has no write HTTP routes. The binding grants HQ **no KV, GitHub, site source, deployment, DNS, or database-write capability**. The adapter is a portable, replaceable Fetcher contract in `src/watchdog-evidence.mjs`.

After Cloudflare Access authentication, `GET /api/edge-watchdog` returns only sanitized status information and the last 24 monitoring snapshots. Any missing service binding, invalid body, stale check (>35 minutes), inconsistent report, or failure is explicitly **not** displayed as healthy. HTTP 503 from an unhealthy watchdog is accepted as a valid incident report and does not mask failure. History is optional and fails closed without hiding a valid latest status.

HQ Control contains one concise mobile-friendly card with last check, 7 check states, failures, and expandable history. An explicit refresh button works without reloading or logging out. It loads automatically when opening `#control`, including deep-linked entry, and caches the view for 90 seconds. Nothing is automatically deployed, rolled back, patched or purchased based on this data.

## Release verification

1. Verify the Watchdog Worker version includes the missing-MIME HEAD fix and read-only history, with a scheduled run in KV.
2. Run `node scripts/test-watchdog-evidence.mjs` and the full `HQ source integrity` CI on the exact branch. Confirm status 503 with valid failure records is displayed as degraded.
3. Upload HQ module Worker with **all prior six bindings unchanged** plus exactly one service binding: `{type:"service",name:"EDGE_WATCHDOG",service:"yorphives-edge-watchdog"}`. Preserve the D1 ID, Access settings, AI binding and existing 5-minute schedule.
4. Confirm Cloudflare deployment and all seven bindings; verify the HQ D1 schema and cron were not changed.
5. **Requires signed-in founder verification:** Open YorpHives HQ → HQ Control → Independent website monitoring; check the live timestamp, seven probes, historical entries, refresh button and small-screen scrolling. Confirm unauthorized access to `/api/edge-watchdog` returns 403.
6. Never count an empty or stale status as uptime success, and never claim end-to-end signed-in verification without a real authenticated browser test.

## Safety and portability

Watchdog status can be publicly inspected at the separate `/status` endpoint, but HQ's combined API remains behind Cloudflare Access. No third-party agent intermediary, expensive monitoring subscription, mutable site permissions, or vendor-specific application schema are introduced. Self-hosting can replace Cloudflare's Worker service binding with a private HTTPS Fetcher, preserving the response contracts and HQ UI.

## Current limitations

No email, SMS, push, or webhook alert delivery is configured. Monitoring incident history is **observational evidence only**. D1 point-in-time restoration was exercised successfully on an isolated disposable database, while an off-provider backup import and live rollback drill remain separate readiness checks.
