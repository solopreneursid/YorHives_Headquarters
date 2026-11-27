# YorpHives HQ — serverless runtime architecture

## Objective

Run the hosted HQ, its deterministic monitors and six specialist AI roles without a founder-owned always-on device. The hosted product is deployed on Cloudflare-managed Workers. A local Linux/Ollama installation remains an optional customer-hosted mode only.

## Runtime topology

```text
Founder browser
  │ Cloudflare Access + same-origin action
  ▼
YorpHives HQ Worker
  ├── deterministic scheduled collectors (existing Cron)
  ├── read-only public-source adapters
  ├── D1 evidence and decision journals
  └── founder-triggered specialist analysis
         │ Workers AI binding
         ▼
     Managed inference
         │ validated, bounded response
         ▼
     Append-only D1 AI analysis journal
         │
         ▼
     Founder review in HQ dashboard
```

## Component responsibilities

| Concern | Service | Design |
|---|---|---|
| HTTP application and API | Cloudflare Workers | Stateless request handling; no resident process |
| Deterministic monitoring | Existing Worker Cron | Existing bounded collectors remain independent of LLM availability |
| AI inference | Workers AI binding | One specialist per founder action; no model tools or external network actions |
| Evidence and audit | Cloudflare D1 | Existing growth evidence plus append-only AI analysis and usage journals |
| Static interface | Existing Worker bundle | Mobile-friendly founder dashboard |
| Local/offline inference | Optional Node/Ollama CLI | Separate customer-hosted deployment; never required by hosted HQ |

## Inference contract

- Provider: Cloudflare Workers AI.
- Model: `@cf/ibm-granite/granite-4.0-h-micro`.
- Specialists: Engineering & Operations; Research & Innovation; Global Market Intelligence; Product & Growth; Revenue & Business; Security & Independent QA.
- Trigger: authenticated same-origin founder POST only.
- Input: one current Growth opportunity and its previously observed, allowlisted public source.
- Limits: 2 new analyses per UTC day; 240 output tokens; evidence packet at most 2,400 characters.
- Idempotency: unique daily claim by opportunity, specialist and evidence fingerprint; repeated completed requests are served from D1 without another inference.
- Persistence: append-only D1 result journal. Failed attempts consume the daily request allowance to avoid uncontrolled retries.
- Output: unverified advisory only. It cannot create or approve a review decision, mark demand/revenue as verified, send messages, write repositories, deploy or change infrastructure.

## Why no Queue or Workflow yet

The current collectors are bounded scheduled Worker tasks, and a specialist analysis is one short, founder-triggered inference request. A queue would add another delivery/retry path without a current burst workload. A Workflow would add durable orchestration without a multi-step process that needs it. Keep the initial system simpler.

Introduce Queues when independent producers create bursty work that must be buffered. Introduce Workflows when an actual investigation spans multiple durable steps, long waits or resumable external dependencies. Neither should be provisioned speculatively.

## Cost and safety controls

- No personal server, static IP, GPU or continuously running container.
- No automatic AI invocation from Cron.
- Daily request cap and per-request token/input bounds are enforced in D1 and application code.
- AI binding and `HQ_GROWTH_AI_ENABLED` are enabled in staging only after Access verification.
- Production feature flags and bindings are not changed by this candidate.
- Provider usage must be checked after the first real staging inference. The application cap is not a promise that provider usage is free.
- If inference is unavailable, deterministic monitoring and research continue unchanged.

## Release sequence

1. Pass candidate CI and offline D1 migration/recovery tests.
2. Back up the isolated staging D1 database and apply migration 0004.
3. Deploy the locked candidate modules to the staging Worker with its dedicated D1 binding.
4. Complete founder browser authentication and anonymous-denial verification.
5. Add the staging-only AI binding and feature flag.
6. Run one synthetic/public-evidence inference and verify persistence, cache and quota behavior.
7. Keep production untouched until separate founder release approval.
