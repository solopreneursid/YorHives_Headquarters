# HQ release security and founder setup

## Current status
The `main` branch must match the Cloudflare Worker `yorphives-hq-free-pilot`
and the approved version/source hash in `hq-release.json`.

There is **no automatic deployment on Git pushes, PRs or merges**. The only
supported HQ publisher is `.github/workflows/hq-production-release.yml`,
triggered manually by the founder and protected by a GitHub environment.

## Verified security status (19 November 2026)

- Founder-approved **read-only** token preflight passed: GitHub Actions run **44365780915** (attempt 2).
- The scoped account-owned `Individual Workers → Editor` token could read `yorphives-hq-free-pilot` and **could not read a different Worker**.
- All four current source modules, nine bindings, approved Worker version and five-minute cron passed comparison.
- `hq-production` required founder approval before the test could execute; the founder configured a main-only deployment branch restriction.
- The CI test made GET requests only; it did **not deploy** or change production. Editing/deployment ability has not been exercised.
- **Open risk:** the existing `YorpHives Account Integration` Cloudflare account token remains active with broad Workers Write rights. It must not be revoked before checking which integrations depend on it. Protected GitHub approvals do not constrain this second token.
- **Visibility:** the repository is currently **public at the founder's request**. The HQ dashboard remains founder-gated by Cloudflare Access; public source code is not private and must contain no credentials. Make the repository private when the founder chooses to launch.

## One-time founder setup
1. Keep deployed HQ private behind Cloudflare Access. The source repository is
   currently public by founder choice; do not commit secrets or private data,
   and restrict repository visibility before launch.
2. In GitHub repository **Settings → Environments**, create `hq-production`.
   Configure **required reviewers** to include the founder, restrict deployment
   branches to `main`, and prevent self-approval if the plan supports it.
   Note: environment protections depend on GitHub plan/account eligibility.
   If approvals cannot be enforced, **do not configure the release token**.
3. Create a **narrow Cloudflare API token** able to read and publish **only the
   intended HQ Worker**, if that resource scoping is available on your plan.
   It should not grant D1 Write, Pages Write, zone configuration changes,
   broader Workers scripts access or account administration. Cloudflare API
   permission/resource constraints must be verified before granting it.
   If it cannot be scoped to just HQ, document and accept that limitation
   explicitly rather than pretending it is isolated.
4. Store the token as GitHub **environment secret** `HQ_RELEASE_TOKEN` and the
   account identifier as `HQ_CLOUDFLARE_ACCOUNT_ID` for `hq-production`.
   Never paste token values into this repository, an issue, or the chat.
5. Before revoking the current broad `YorpHives Account Integration` token,
   independently confirm which current integrations use it. Rotate safely;
   revoking it may disconnect legitimate Cloudflare management access.
6. Review repository branches and GitHub Actions secrets. No old workflows may
   hold production deployment credentials.
7. Configure branch protection/ruleset for `main`: require current HQ integrity
   and synthetic-browser workflows, disallow force pushes, and restrict direct
   writes. The GitHub connector cannot enforce these account settings.

## Deployment (after CI and founder review)
1. Verify `node scripts/verify-current-hq.mjs` passes on the exact approved commit.
2. Update `hq-release.json` module hashes through review whenever code changes.
3. Open Actions → `HQ production release (manual, founder approved)` → Run.
4. The manual workflow derives the expected live Worker version from the reviewed
   `hq-release.json` and takes the checked-out `main` commit SHA automatically.
   Confirm the one prefilled `RELEASE_FOUR_BUTTON_HQ` field. Never paste a token
   or account ID into the workflow form.
5. Approve the GitHub deployment environment review (if available).
6. The script compares live Worker version, nine binding name/type pairs,
   compatibility date and cron schedule; if anything differs it **aborts**.
   If code already matches, the script reports no change.
7. After authorized publishing, verify the founder-only Access gate, signed-in
   browser self-test, 4 navigation pages, API/D1 status and independent watchdog.
8. Record the resulting Worker version and source hashes in the private release
   manifest. A successful Worker API response is not full production certification.

## Limitations
The Cloudflare account API currently has a broad connected integration token with
Workers Write. A GitHub manifest or SHA check cannot prevent overwrites performed
through that separate permission. The enforceable solution is founder-controlled
credential scoping/revocation and GitHub production environment protection.
No browser session or OTP credentials are stored in GitHub.

## Current pending release: Products trending finder (19 November 2026)
The GitHub `main` source includes the evidence-led Products tab, scheduled
seven-source scan registry and private `/api/trending-products` endpoint.
Source integrity and offline Products tests passed. Browser regression exercises
both mobile and desktop without accessing production. These changes remain
**unpublished** while the live version is `0aa5ea9f-9d8d-4e56-966d-8920ffc5fff1`.
Founder approval through the protected manual release workflow is mandatory.
Do not overwrite production with a broad account token to bypass that approval.
