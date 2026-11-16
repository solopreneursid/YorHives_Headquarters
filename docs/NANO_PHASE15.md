# Nano Phase 15 — Declared Dependencies, Licensing Exposure & Compute Signals

## Goal and operating boundary

Turn existing Phase 14 SHA-pinned GitHub root evidence into founder-readable,
source-linked **preliminary** dependency and cost-risk observations. This is
not a verified dependency inventory, license clearance, hardware benchmark,
cost quote, or confirmation that the GitHub candidate belongs to the paper.

No paid models, third-party agents, GitHub credentials, repository checkout,
code execution, autonomous change, API credential creation, or independent
HTTP requests are added by Phase 15. HQ is permanently **observation,
research, evidence, and recommendations only**.

## Phase 15 static extraction

Phase 14 already stores one selected small manifest and optionally one
license-file observation (each ≤16 KB). Historically collected
`pyproject.toml` files had been recorded without dependency parsing.

Phase 15 adds a deliberately incomplete static parser, for a future
Phase 14 SHA-pinned read of an allowlisted `pyproject.toml`, that recognizes:

- `[project]` → `dependencies`: main runtime *name candidates*.
- `[project.optional-dependencies]`: optional extras, possibly platform-specific.
- `[dependency-groups]`: simple PEP 735 lists (installation depends on tooling).
- `[tool.poetry.dependencies]`: Poetry main table, excluding `python` version key.
- `[tool.poetry.group.<name>.dependencies]`: Poetry group entries,
  without claiming optionality (groups may be installed by default).

It never executes a TOML script, imports a Python module, resolves or installs
requirements, reads package source trees, or stores raw package config strings.
Comments, unrelated tables, scripts, lockfiles and unrecognized constructs
are outside the assessment. Stored evidence contains capped name counts and
eight examples; it is not a complete or resolved dependency graph.

A prior unparsed `pyproject.toml` can receive **one** eligible SHA-pinned
backfill inspection, charged to Phase 14's same atomic daily quota of at most
**two GETs per UTC day**, shared with the preexisting public-fetch cap.
There is **no new Cron**. Other requested root files are prioritized before
a backfill. Once parser version `pyproject-declared-subset-v1` is recorded,
this backfill does not repeat.

## License and compute assessments

- Display GitHub-reported SPDX (if present), and separate verified SHA
  *presence* of a root LICENSE file. Neither confirms license terms,
  dependency licensing, copyright, model-weight or dataset rights, or legal
  suitability for commercial use. No automated approvals.
- Recognized library-name categories indicate possible accelerator stacks,
  robotics/simulation, and training/distributed software. These signals do
  **not** prove GPUs are required, specify models' RAM/VRAM, or estimate
  free-tier compatibility. No public-cloud prices or compute costs are guessed.
- Complete hardware, runtime, operational spending and ROI assessment requires
  an independently controlled, founder-approved isolated benchmark with resource
  ceilings, a version-pinned inventory, and explicit source/legal review.
- The provenance link between a paper and a GitHub repository stays
  **unconfirmed** if discovered through title-matched search.
- Stale evidence must not transfer between repository identities, and file
  evidence SHA must match the selected root catalog before display.

## UI

A collapsed **Phase 15 · Dependency & compute signals** card is displayed
in **Discover → Research journals** and **AI Employees**. It shows verified
metadata only, file hash, main vs optional/group signals, compute indicators,
legal uncertainty and founder-reviewed next steps.

## Tests and release

Run `scripts/test-nano-dependencies.mjs` with existing integrity checks and
mobile/desktop browser tests. Use PR review and safe deployment to the isolated
`yorphives-hq-free-pilot` only. Preserve all existing six bindings, Access,
D1 records and five-minute Cron; do not update `yorphives.com`.

After deployment verify that a real scheduled manifest backfill produced a
partially parsed evidence record. Until that happens, the UI must show
**waiting for parsed manifest** rather than inventing dependencies.
