# YorpHivesHQ recovery and verification

Status: 2026-11-16. This is an operational guide, **not** proof that a full restoration has been tested.

## Source of truth

- The currently deployed HQ Worker has a source snapshot at `src/hq-worker.mjs`.
- Run `node scripts/verify-hq.mjs` before a release.
- The `HQ source integrity` GitHub Action also checks syntax, embedded UI assets, the incident ledger hooks, authentication guard, and read-only policy.
- This repository is **public**. Never commit Cloudflare Access credentials, private database exports, tokens, or owner records.
- The snapshot includes an embedded static asset fallback; if a future Worker uses an external assets binding, preserve those assets separately.
- This is **not automated synchronization** between the deployment and GitHub: repeat the source snapshot following each authorized deploy.

## External health monitoring

- Workflow: `.github/workflows/independent-health.yml`.
- Checks `https://yorphives.com/` returns a 2xx status.
- Checks the HQ workers.dev entrypoint redirects an anonymous request into Cloudflare Access.
- Scheduled at minute 17 and 47 every hour, and run on updates to the monitoring workflow.
- GitHub Actions failures can be inspected in the repository's Actions tab. Confirm notification settings independently.
- Scope: external availability and Access gate only. A passing result **does not** prove authenticated API, D1, scheduler, or application functionality.

## D1 persistence and incident history

- The existing D1 binding is named `DB`.
- Incident records persist in `incident_history`, transitions in `incident_events`.
- Do not delete or overwrite those tables when changing the frontend.
- Cloudflare D1 Time Travel bookmark retrieval was available when checked on 2026-11-16, but **a restoration has not been executed or tested**.
- Restore only on founder authorization, ideally against a separate recovery database first.
- Never put a production database export in this public repository.
- Time Travel is not a substitute for an independent, access-controlled export kept under founder control.

## Recovery sequence

1. Stop new deployments and preserve current evidence and version IDs.
2. Confirm founder Cloudflare Access and GitHub permissions.
3. Compare deployed Worker code with `src/hq-worker.mjs` and run `node scripts/verify-hq.mjs`.
4. Inspect the latest Cloudflare Worker deployment, bindings, routes, and compatibility date; do not blindly overwrite these settings.
5. Restore into an isolated test Worker and separate database using a founder-approved copy or backup.
6. Test public website health, HQ login, authenticated report API, D1 reads, recurring collector, and incident history.
7. Only after successful isolated testing, explicitly approve any production rollback or database restoration.
8. Verify the monitoring workflow runs and captures fresh post-recovery evidence.

## Permissions and operating boundary

- Deployed HQ agents: observe, research, detect, analyze and recommend.
- No website edits, repository writes, deploys, payments or arbitrary commands by deployed agents.
- The founder executes and approves production changes.

## Outstanding acceptance tests

- Authenticate in a browser, navigate all pages and check that browser Back never signs out unexpectedly.
- Confirm `/api/report` with a valid founder session returns current D1 evidence.
- Run a controlled incident detection/recovery test in staging; confirm history is not erased.
- Execute an isolated D1 recovery test before claiming backup/restore readiness.
- Verify notifications actually reach the founder when the independent monitor fails.
