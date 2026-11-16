# YorpMind Nano — Cloudflare AI and self-hosted inference

Status: **Cloudflare Workers AI integrated** (2026-11-16). The self-hosted alternative is prepared but not connected. Model inference through Cloudflare's AI API was independently smoke-tested with a tiny request. The actual signed-in HQ investigation flow still requires a real open finding.

## What is implemented

HQ's six departments can request read-only assessments of an **existing open finding** using a founder-selected department. All inference requests require the founder's existing Cloudflare Access authentication and a same-origin browser request. No tools, repository tokens, database credentials, shell execution, deployment permissions, payment APIs or autonomous writes are exposed to the model.

This is an **on-demand investigation adapter**, not six continuously running autonomous agents. Model outputs are advisory, explicitly unverified, not stored, and require founder review.

The adapter supports any self-hosted OpenAI-compatible **HTTPS** `/v1/chat/completions` endpoint. For example, a model server running locally with an HTTPS reverse proxy owned by the founder. Cloudflare Workers cannot reach private `localhost` or RFC1918 LAN addresses on the founder's computer directly.

## Cloudflare Workers AI — currently active

- The HQ Worker has an `AI` binding and defaults to `@cf/ibm-granite/granite-4.0-h-micro`.
- Founder-triggered analysis of an **existing open finding** only. Six selectable specialist roles share one model.
- D1 atomic daily quota reserves at most **2 HQ Cloudflare inference requests/day** using `quota.kind='hq_workers_ai_requests'`. Failed attempts count against the HQ request budget.
- Maximum 260 response tokens per call, non-streaming, bounded evidence input, no tools.
- This HQ-level request counter is **not** a measurement of Cloudflare Neurons. The Cloudflare Workers Free plan enforces its own 10,000-Neuron daily allowance at account level; account-wide use from other projects must also be considered.
- Cloudflare hosts inference. This is **not self-hosted or wholly private infrastructure**. Only selected finding fields are sent when the founder requests an assessment.
- The frontend shows whether the model is configured, and all output remains labelled unverified. No automatic updates, autonomous deployments or payments.

## Optional self-hosted replacement — future

The existing self-hosted HTTPS adapter remains available and takes precedence when explicitly configured. Models and department roles remain replaceable.

## Required secrets and settings

Configure in the HQ Worker environment, via Cloudflare's secure binding controls:

- `HQ_PRIVATE_AI_URL`: full founder-controlled HTTPS URL ending exactly in `/v1/chat/completions`.
- `HQ_PRIVATE_AI_MODEL`: the model ID exposed by your own open-weight inference server.
- `HQ_PRIVATE_AI_TOKEN`: a **secret**, generated and accepted by your own HTTPS gateway; never add this token to GitHub source or a browser bundle.

Do not use hosted commercial model APIs or expose an unauthenticated model endpoint to the internet. Keep model-server access behind TLS and gateway token validation. Prefer a dedicated, narrow proxy that accepts only model inference and rate limits requests. Do not reuse the Cloudflare Access founder token.

**No self-hosted settings above have been created.** The existing Cloudflare AI binding provides the current inference option. Without an open finding, the UI will have nothing to analyze.

## How the request works

1. Founder opens **AI Employees** and chooses a department and existing open finding.
2. Clicking **Analyze finding** sends a same-origin POST to `/api/ai/analyze`.
3. The Worker authenticates the founder and validates department and finding ID.
4. The Worker reads only the bounded finding fields from HQ's D1 database.
5. The Worker calls the explicit fixed HTTPS model endpoint, using the server-side secret, with tools disabled, no streaming and a 12-second timeout.
6. The browser shows an unverified advisory; no automatic actions occur.

There is no worker-scheduled model inference. Nothing is uploaded until the founder explicitly chooses **Analyze finding**.

## Security and test scope

The automated checks verify self-hosted disabled-by-default behavior, HTTPS configuration, invalid-input rejection, Cloudflare quota-fail-closed behavior, response contracts, same-origin and Access guards, and browser UI behavior when the model is unavailable.

The Cloudflare Granite model was directly smoke-tested through the account API. The current tests do **not** verify a real HQ finding-based call in the signed-in browser, response quality, autonomous workforce execution, or a self-hosted gateway. A real connection test requires a reachable founder-operated HTTPS model server and its credentials, set directly by the founder.

## Next self-hosted deployment steps

1. Provision a machine that the founder owns or controls.
2. Install an open-source model runtime and a suitable open-weight model under a compatible license.
3. Put a dedicated HTTPS gateway with token authentication and rate limits in front of the `/v1/chat/completions` route.
4. Add the three environment bindings securely to the HQ Worker, then test **AI Employees → Analyze finding** on an existing open finding.
5. Independently review the output and record whether it correctly distinguishes evidence from speculation.
6. Only after successful connectivity tests consider persistent local memory, queue processing, and multi-agent scheduling.

The six specialist labels currently represent department routing, not proof of separately running AI employees.
