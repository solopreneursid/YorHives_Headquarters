# HQ release automation — safe updates without repeated founder clicks

## Objective

Routine YorpHivesHQ changes should publish automatically **after merging to main**, never from the deployed HQ agents. Only GitHub Actions can obtain the existing scope-limited `HQ_RELEASE_TOKEN` stored in the existing `hq-production` environment. No new services, subscriptions, secrets, production website permissions or HQ database migrations.

The four-button HQ runtime remains monitoring / research / analysis / recommendations **only**.

## Automatic route

A push to `main` runs `.github/workflows/hq-production-release.yml`. An unprivileged scope job checks the precise files changed and fails closed for sensitive changes. Only then can the deployment job access the environment. It independently verifies source SHA locks, tested Products and Revenue behavior, and a synthetic Chromium mobile + desktop UI. It reads the live Cloudflare Worker source and requires a precise match to the previous merged `main` module snapshot; out-of-band or partial deployments block further automatic publication. No retry of the upload operation.

The route allows narrowly scoped changes to:
- `src/products-ranker.mjs` (deterministic public-interest analysis);
- `src/revenue-intelligence.mjs` (deterministic founder revenue research ranking);
- embedded `/hq-simple.js`, `/hq-simple.css` and `/hq-simple.html` UI assets in `src/hq-worker.mjs`, **only when the rest of the Worker code stays byte-identical**;
- the exact-source release manifest, corresponding tests and documentation.

Other HQ Workers, frontend website, scanner implementations, credentials, cron schedule, JWT authorization, Worker routes/bindings, workflow definitions, infrastructure controls and deployment publisher changes are **not** auto-eligible. Changes that fail scope are reported as `MANUAL RELEASE REQUIRED` and do not access release secrets. Publisher checks keep nine bindings, compatibility date, scheduler and pinned module source immutable except for explicitly reviewed module contents.

## Manual route (rare)

The existing GitHub Actions `workflow_dispatch` option remains available for sensitive reviewed changes, requiring literal `RELEASE_FOUR_BUTTON_HQ` and a pinned current live Worker baseline. It does not grant production mutation rights to any HQ research agent.

## One-time configuration

This automation reuses environment secrets that are already connected. If GitHub `hq-production` has **Required reviewers**, the auto-deploy job will pause for review even though all checks passed. To avoid recurring prompts, the repository administrator must **once** open `Settings → Environments → hq-production`, disable the **Required reviewers** rule for routine deployments, and save. Do **not** delete the environment or secrets. This reduces one human approval layer: retain limited write access to `main`, protect `main` with PR/CI checks where possible, and review administrative settings changes carefully.

The first bootstrap (PR following `fcad1341f06100d23f7ff6e50db0ff505de859e6`) is an explicit one-time exception allowing only the exact new CI workflow, publisher-mode wiring, scope/test scripts and this doc. It uses current independently verified production version `efdb1d2a-2d56-4a4f-89c2-8505fa4dfa1c` plus pinned live source hashes. Once that first publication completes, subsequent auto changes compare to the **previous main commit**, avoiding the old chore of updating Cloudflare deployment version manually after each change.

## Failure handling and checks

GitHub Actions errors stop publication. A failed source check, scope mismatch, stale/live module drift, changed cron/bindings, unavailable token, broken browser, or Cloudflare upload error does **not** retry a live PUT or bypass approval. The existing manual workflow and exact-source preflight remain the recovery route after the underlying issue is investigated.

The scope checker and tests use only Git history locally; they cannot access a browser token, Cloudflare secret or external site. This implementation does **not** create self-editing HQ agents and does not deploy yorphives.com or GovRadar.

## Acceptance

Inspect GitHub Actions `HQ production release (safe auto / sensitive founder manual)` after the first merge. A routine change should automatically finish `auto-scope`, `safe-auto-release`, the source test suite and post-upload code verification. An unrelated/sensitive code change should finish `auto-scope` with `eligible=false`, skipping deployment and never requesting environment approval. If an environment approval remains required, complete the one-time setting above; no need to approve every subsequent safe update.

## Bootstrap workflow syntax repair

The first automatic-run workflow failed YAML parsing on a `run: echo` line that contained an unescaped `:`. The repair uses a multiline YAML block and intentionally rebases the **one-time-only** trusted bootstrap parent from `fcad1341f06100d23f7ff6e50db0ff505de859e6` to `bc0601193e5e2902545bec95a7567bab5c8dbc12`. No Cloudflare deployment occurred on the invalid workflow run. All regular automatic releases still reject workflow/deployer changes.
