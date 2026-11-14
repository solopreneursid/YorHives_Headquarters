# Headquarters read-only QA & agent review system

This review setup is developed in the YorpHives Headquarters repository and is intended to run on **your own Linux x86-64 machine**, not in the public website. It does not connect live scanners or AI model inference to the deployed HQ yet.

## Selected free and open-source components

| Component | Purpose | Source | Selected version |
| --- | --- | --- | --- |
| [reviewdog](https://github.com/reviewdog/reviewdog) | Aggregate linter diagnostics and present local diff review results | OSS / MIT | v0.21.3 |
| [Betterleaks](https://github.com/betterleaks/betterleaks) | Look for secrets in working files and Git history | OSS — verify repository LICENSE before commercial use | v1.10.1 |
| [Trivy](https://github.com/aquasecurity/trivy) | Scan source for known dependency vulnerabilities, secrets and misconfigurations | OSS / Apache-2.0 | v0.76.2 |
| [Playwright Python](https://github.com/microsoft/playwright-python) | Desktop/mobile Chromium journeys and regression tests | OSS / Apache-2.0 | 1.65.2 |
| [PR-Agent](https://github.com/The-PR-Agent/pr-agent) | Optional model-assisted review of a local branch diff | OSS / MIT | v0.50.0 |
| [Ollama](https://github.com/ollama/ollama) | Locally host an open-weight model; no code leaves your server | OSS / MIT (model weights have separate terms) | Install separately |

**Current status:** The install/test scripts are in source control, not proof that the binaries were downloaded or checks executed on your server. No signed scan results are available yet. Never label pending checks as passed. These version selections are a 2026-11-14 snapshot and should be upgraded after change review.

### Deployment rules

- **No bot receives repository-write, GitHub PR-write, deployment, or configuration credentials.**
- No automated fixing, branches, commits, merging, or deployment in the deployed Headquarters service.
- Run the code under an unprivileged user in a private isolated worktree / container with read-only source mounts and a separate writable report directory.
- Downloads should occur in an owner-operated installer, *not* inside deployed HQ workers. Source snapshots and signed evidence can then be passed to analysis agents.
- Scanner output may contain secret values. `.review-tools/` is gitignored and local only; never publish raw scanner logs. Redact before ingestion.
- PR-Agent's **local git provider** is used intentionally: it compares committed changes to a local `main` branch and writes a local Markdown review. It cannot post to a hosted PR.
- AI opinion is never a release approval. Deterministic tests and human review remain mandatory.

## Install on your private machine

Run these exact commands in an Ubuntu terminal with Python 3, git, curl, Node.js 22+, and adequate disk space:

```bash
git clone https://github.com/solopreneursid/YorHives_Headquarters.git
cd YorHives_Headquarters
git fetch origin design/headquarters-command-center-20261114
git switch -c design/headquarters-command-center-20261114 --track origin/design/headquarters-command-center-20261114
python3 scripts/bootstrap-review-bots.py
python3 -m venv .review-tools/qa-venv
source .review-tools/qa-venv/bin/activate
python -m pip install "playwright==1.65.2"
python -m playwright install chromium
bash scripts/run-review.sh --full
```

The installer calls the GitHub release API for **exact tags**, selects a Linux x86-64 archive, checks the GitHub-provided SHA-256 digest, and extracts only the exact binary. It refuses releases with missing checksums. It installs into `.review-tools/bin` and does not use `sudo` or `curl | bash`.

The browser runner binds a temporary local HTTP server to `127.0.0.1` only, tests without credentials, verifies no external browser network requests, and writes screenshots into the ignored local reports directory.

To run lightweight checks without downloaded scanners (Playwright must still be available):

```bash
bash scripts/run-review.sh --quick
```

### What is tested

1. Node.js syntax parsing, HTML/JS element references, duplicate IDs, broken navigation, unsanctioned external scripts and dangerous HTML sinks.
2. Unit tests verifying that broken JavaScript and broken DOM references actually cause review failure.
3. Headless Chromium tests for overview loading, monitoring and opportunity filters, imported-report provenance labels, safe text rendering against injection, safe evidence URLs, and responsive mobile navigation.
4. reviewdog presenting structured quality diagnostics **locally** with its local reporter.
5. Betterleaks detection on tracked application/test files and full Git history; confidential reports are local-only.
6. Trivy scanning for high/critical known vulnerabilities and misconfigurations, using its vulnerability database. Trivy needs network access to its upstream DB mirror for freshness; a failed DB download is a **blocked scan**, not a pass.

If any required external tool or browser is unavailable, the full runner exits nonzero. Do not interpret a tool's installation as test completion.

## Optional local AI agent reviewer

PR-Agent v0.50.0 supports a **local Git provider** and configurable Ollama model; no hosted PR credentials are required.

```bash
# From the repository checkout; with a locally running Ollama server already installed:
ollama pull qwen2.5-coder:7b
bash scripts/run-local-ai-review.sh --install
bash scripts/run-local-ai-review.sh --review
```

The script expects Ollama on `127.0.0.1:11434` and a committed `main` branch. It uses `ollama/qwen2.5-coder:7b`, a local model endpoint, a local git branch comparison, and an ignored `.review-tools/reports/pr-agent-review.md` output path. Ensure Ollama's model context is **at least 8192 tokens**, and make a deliberate owner-reviewed choice of model weights/license before commercial use.

**Limitations:** Small local models can miss security defects, return false positives, or fail structured review prompts. This run is an experiment until its quality is calibrated with deliberately seeded bugs and compared against deterministic tests. Do not run PR-Agent with GitHub-hosted review mode, write tokens, or PR publishing flags inside Headquarters.

## Integration with Headquarters UI

To display findings without claiming live monitoring, transform approved/redacted scanner output into the local JSON report format described in the main README. Each record must carry an actual evidence reference, originating tool/version, timestamp, affected asset and uncertainty/priority. The current `Import intelligence report` feature labels it **Imported — unverified**, not live or independently verified.

For future production: run independent collectors on isolated read-only snapshots, store signed/immutable evidence separately, allow specialist AI models to analyze *only* that evidence, then queue proposals for founder review. Scan Headquarters itself separately so failure of one system cannot falsely report both systems healthy.

## Next safe engineering milestones

- Validate scanner versions and archives on the owner's server, run tests and retain private sanitized evidence.
- Introduce a **signed** JSON findings adapter (schema version, scanner ID, UTC time, source commit SHA, evidence hash and confidence).
- Build an independently authenticated, private report ingestion service; avoid exposing scanner results in public HTML.
- Run recurring review checks from a self-hosted portable scheduler using a non-root, network-limited identity; alert on failed or missed scans.
- Track agent false positives, missed defects, latency, inference budget and tool-version drift; only propose upgrades.
