# YorpHives Headquarters — Mission Control UI

A private, founder-first interface for a self-hostable AI office that **observes, investigates, researches, and recommends** — but **never modifies** YorpHives systems. This branch introduces an independent, dependency-free frontend prototype.

## What is in this prototype

- A cohesive, mobile-responsive command center with Overview, Monitoring, Opportunities, AI workforce, Activity & evidence, and Governance views.
- Priority inbox organized by finding severity and affected system.
- Opportunity radar organized by product, revenue, and technology research.
- Six example department responsibilities.
- Search (Ctrl/Cmd+K), filters, detail dialogs, evidence URLs, copyable summaries, mobile navigation, and keyboard-accessible controls.
- Local JSON report import via the browser file picker, so a founder can explore observations without granting write access.
- **Visible provenance labels.** Every bundled record is labelled as an **example**. A report imported from disk is labelled **imported/unverified** because importing a JSON file does not prove it is authentic or current.

**This is UI, not a working production monitoring service.** No scanners, automated research jobs, live status endpoints, local model inference, alerts, accounts, authentication, or trusted ingestion have been connected by this PR. The dashboard never makes requests to third-party APIs.

## Preview locally

No Node, npm, external fonts, analytics, or cloud services are required.

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080` from the machine running the command.

For a quick preview, you can also open `index.html` directly in a modern browser. When attached to a web server, it remains fully static.

## Example intelligence report

Save the JSON below to a local file, then click **Import intelligence report** in the UI:

```json
{
  "assets": [
    {
      "id": "website",
      "name": "YorpHives website",
      "kind": "Public platform",
      "status": "unknown",
      "summary": "No trusted live check attached"
    }
  ],
  "findings": [
    {
      "id": "F-001",
      "title": "Dependency needs maintainer review",
      "category": "dependencies",
      "priority": "medium",
      "asset": "YorpHives website",
      "description": "Example text from a read-only dependency inventory.",
      "recommendation": "Confirm vendor support policy, then plan a founder-reviewed update.",
      "observedAt": "2026-11-14T12:00:00Z",
      "evidence": ["https://example.org/advisory"]
    }
  ],
  "opportunities": [
    {
      "id": "O-001",
      "title": "Potential narrowly-scoped product opportunity",
      "category": "product",
      "confidence": "Needs customer validation",
      "description": "Example market research summary.",
      "recommendation": "Validate willingness to pay before building.",
      "observedAt": "2026-11-14T12:00:00Z",
      "evidence": ["https://example.org/research"]
    }
  ],
  "agents": [
    {
      "id": "research",
      "name": "Research & Innovation",
      "responsibility": "Track relevant open technologies and market changes.",
      "status": "not_connected"
    }
  ],
  "activity": [
    {
      "id": "E-001",
      "title": "Example report event",
      "summary": "Data received from a local file.",
      "kind": "research",
      "occurredAt": "2026-11-14T12:00:00Z"
    }
  ]
}
```

Supported values: asset status = `unknown | healthy | degraded`; finding category = `security | dependencies | reliability | quality`; priority = `high | medium | low`; opportunity category = `product | revenue | technology`; agent status = `not_connected | running | idle | error`. Unsupported values fall back to a safe default. Imported records are still unverified even if their status field says `healthy`.

The import is restricted to a 2 MB file and at most 200 records in each array. Text is rendered with `textContent`; linked evidence URLs are accepted only for `https:` and `http:`; the data is kept in browser memory and is **not** transmitted by the application.

## Recommended next engineering phases

1. **Private access and trusted evidence.** Protect the HQ UI with self-hosted authentication. Set up a read-only, authenticated adapter to a locally controlled append-only evidence store, signed event metadata, trusted timestamps, and scoped collectors.
2. **Independent operational checks.** Connect self-hosted Uptime Kuma for uptime/TLS, GlitchTip for exceptions, Playwright for synthetic journeys, Trivy for dependencies/secrets/images, and tightly scoped passive vulnerability scanners. Review upstream licenses, maintenance, and minimum resource needs before installation.
3. **Evidence-first intelligence agents.** Use self-hosted open-weight inference on an event-driven basis to triage verified observations and research product/market/monetization leads. Preserve source URLs, timestamps, confidence, costs, and memory.
4. **Founder review and feedback.** Add a separate durable review queue, feedback labels, verified outcome tracking, and explicit founder approval. Workers remain strictly **read-only**; the separate founder-owned execution path may apply changes when directed.
5. **Service health and operational resilience.** Add independent checks of Headquarters itself, backups, restore tests, incident alerts, audit trails, and dependency inventory including the detectors/agents.

An eventual private dashboard API should support records with stable identifiers, evidence links, observation times, source IDs, risk classification, and status. Prefer a versioned JSON contract over framework-specific coupling.

## Security invariants

- The deployed HQ workers **must never** have repository write permissions, deployment tokens, production mutation credentials, or API operations that change assets/configuration.
- Security scans default to passive and low-impact. Only explicitly scoped checks may run against authorized systems.
- HQ is not a public page. **Do not publish private evidence on a public GitHub Pages/Cloudflare site** or expose a real operational feed without proper server-side authentication and network restrictions.
- The import is a viewer convenience, not source verification. A proper signed/verified pipeline is still required.
- Separate deterministic detection from speculative model analysis; a model's statement is not an independently verified uptime check.
- Commercial use of open-source projects and model weights depends on their specific current licenses. Validate before adoption.
- Preserve portability and swapability of models, scanners, storage, schedulers, and analysis agents.

## Repository layout

```
index.html      # semantic dashboard screens, dialogs, navigation
styles.css      # responsive dark design system, no third-party assets
dashboard.js    # interactive local-first view, demo data, JSON import
README.md       # setup, schema, safety/architecture boundaries
```

## Initial open-source bot/monitor candidates (research only; not installed)

| Candidate | Role in HQ | Current operating boundary |
| --- | --- | --- |
| [Uptime Kuma](https://github.com/louislam/uptime-kuma) | Independent HTTP/TLS/DNS availability monitoring | Self-hosted, read-only probes; no site administration credentials. |
| [Trivy](https://github.com/aquasecurity/trivy) | Dependency, vulnerability, secret, license and misconfiguration findings | Scan read-only repository snapshots and redact any detected secret values before storing evidence. |
| [Playwright](https://github.com/microsoft/playwright) | Browser journey and regression verification | Isolated test accounts, read-only flows where possible, low request rates. |
| [Renovate OSS](https://github.com/renovatebot/renovate) | Outdated dependency and available-upgrade intelligence | **Do not run the default write-capable bot inside HQ.** Evaluate only its `dryRun: "lookup"` read-only reporting mode, with repository read-only credentials, isolated from every deployment mechanism. Its OSS license is AGPL-3.0-only. |
| [Nuclei](https://github.com/projectdiscovery/nuclei) | Vulnerability template research and cautiously scoped security checks | Do **not** launch arbitrary active templates unattended. Only authorized, rate-limited, reviewed templates; passive-first alternatives are preferable. |

The entries above are integration **candidates**, not installed or approved components. Before adoption, review the actual project/license at the selected version, monitor resource cost and maintenance, and test that the process cannot mutate repository or infrastructure state. Research agents should have a disposable sandbox and zero secrets except specifically scoped read-only tokens.

## Free, self-hosted code-review bots (experimental)

An optional local-only QA pipeline has been added on this review branch. It includes a verified-release installer for reviewdog, Betterleaks and Trivy; deterministic code checks; Playwright browser smoke tests; and an opt-in PR-Agent reviewer using local Ollama. No external bots have been installed on your server and no browser or security scan has been executed yet.

Full guide: [Code review bot setup](docs/REVIEW_BOTS.md) · [Current verified/blocked checks](docs/REVIEW_VALIDATION.md)

In a branch checkout on your private machine, the starting commands are:

```bash
python3 scripts/bootstrap-review-bots.py
python3 -m venv .review-tools/qa-venv
source .review-tools/qa-venv/bin/activate
python -m pip install "playwright==1.65.2"
python -m playwright install chromium
bash scripts/run-review.sh --full
```

**Important:** All report files remain under the local gitignored `.review-tools/`. Deployed Headquarters employees continue to be read-only. See the guide for setting up optional private model review.
