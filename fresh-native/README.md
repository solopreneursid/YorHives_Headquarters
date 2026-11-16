# YorpHivesHQ — Native Fresh Build (Phase 1)

Private, single-founder mobile-first command center. Original supplied Y emblem preserved. Completely independent implementation under `fresh-native/` in the existing GitHub repository; no legacy HQ code or data reused.

## Scope implemented

- Six pages: Home, Discover, AI Team, Decisions, Growth, Control.
- Responsive navigation: four bottom tabs + More on mobile, six-link desktop sidebar.
- Authenticated Cloudflare Worker, fail-closed Access JWT verification (issuer, audience, email, signature).
- Separate Cloudflare D1 database for health status, research leads, bookmarks, and founder decisions.
- Bounded public GET source adapters: HN Algolia, DEV Community. Results are **unverified leads**, not AI findings.
- Site availability check (HTTP status), cron heartbeat, manual scan cooldown, and decision audit state.
- Founder decisions record approval/rejection/snooze only: no code changes, site mutations, deployment, or purchases.
- YorpMind AI, growth metrics, learning and upgrade engine are visibly **not connected/planned**.

## Architecture and limits

Cloudflare Free only, no local always-on model, no Docker, no paid APIs. One Worker + one D1 database + one Access app. Two public source GET requests per scan; 15-minute scan cooldown, recurring site checks every 15 minutes and research checks every 6 hours. CPU/network/data usage must be monitored; free tiers can change.

## Security

All routes, including `/`, require authenticated Cloudflare Access JWT belonging to founder. Access application must protect the Worker itself; Worker validates RS256 signature in defense in depth. POST requires same-origin `Origin`. No agent is granted GitHub write/deploy credentials. Output is escaped, source URLs must be HTTPS. Non-public account data never appears in public GitHub source files.

## Testing

```
node --test tests/worker.test.mjs
python tests/ui_test.py
```

Browser test uses mocked API and system Chromium across 320/390/768/1024/1440 px. These tests **do not** verify real Cloudflare authentication or external source connectivity, which require signed-in smoke tests.

## Release and rollback

`worker.mjs` has a `__PAGE_HTML_BUILD_REPLACEMENT__` string replaced with JSON-stringified `index.html` at publish time. Bind D1 named `DB`, Access `ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`, `ACCESS_OWNER_EMAIL`. Deploy as separate script `yorphiveshq-native-preview`. Never touch `yorphives-hq-free-pilot` or `yorphives.com` during preview. Record version/deployment ID for rollback.

## Next

Verify signed-in Access flow, public source scans, D1 persistence, quota tracking, independent watchdog. Integrate optional budgeted Workers AI only after a working free-tier usage controller is proved. Founder approves any future cutover.