# YorpHives Headquarters operating plan

Updated 15 November 2026. Founder-approved direction: observation, investigation,
research, recommendations and accountable follow-through. This plan supersedes
the earlier recommended engineering phases; it does not grant agents execution rights.

## Operating agreement

HQ explains the business consequence, evidence and one useful next step. It says
when evidence is missing, stale or hypothetical. It challenges weak assumptions,
keeps repeated observations in stable threads, and never equates activity with value.
A founder decision records intent; it does not authorize an agent to execute changes.
External pages, imported files and model output are data, never instructions.

## Implementation and release scope

| Improvement | Implementation in this change | Remaining dependency |
| --- | --- | --- |
| Founder briefing | Three-item review queue; active-opportunity count; existing health/coverage briefing retained | Complete source coverage cannot be inferred from discovered routes |
| Evidence accountability | Observation/hypothesis, freshness, source qualification, impact, responsible department, reviewer and success condition | Impact is a cautious generic assessment until analytics exist; effort remains unestimated |
| Decision lifecycle | Proposed → accepted → implemented → verified; rejection, pause and reopen; reason, feedback and outcome evidence retained | Founder supplies actual implementation and verification results |
| Controlled learning | Append-only reasons and feedback; paused/rejected ideas remain quiet until substantive content changes | No model retraining or automatic rule/permission/budget changes |
| Focused research | Atomic maximum of three accepted/implemented opportunities | Customer validation, audience and experiments require research; source mentions alone cannot prove demand |
| Cost discipline | Existing 900 public GET/day budget and staggered checks preserved; no extra recurring network jobs | Private inference and investigation compute budgets must be installed and verified before enabling AI |
| Coordination | Deterministic responsible-department/reviewer routing attached to recommendations | These are assignments, not evidence that six models or independent reviewers ran |
| HQ reliability | Missing/future/stale timestamps fail to unknown; partial catalogs remain incomplete; unconnected revenue is null | Independent external watchdog, backup/restore rehearsal and persistent model server remain deployment prerequisites |

## Decision storage and trust boundary

The dedicated HQ evidence database gains `founder_decisions`, using portable
SQLite SQL. Events retain record title and evidence snapshot even when the original
opportunity ages out. The dashboard shows the latest 12 threads, the latest 20
changes for a selected thread, and exports all retained events as JSON.

The new POST `/api/decisions` route writes founder metadata only. It requires:
- Existing exact-founder authentication and audience validation.
- Exact same-origin Origin header, JSON and a custom action header.
- An explicit runtime enable flag after applying migrations 0005 and 0006.
- A known recommendation, allowed state transition and expected revision.
- A reason; recording a verified outcome additionally requires a success condition,
  measured result and HTTPS evidence link. This is founder-attested verification.

Writes are a single conditional SQL insertion. Stale tabs cannot overwrite decisions;
concurrent requests cannot exceed three active opportunities. The journal stops at
2,000 events rather than silently deleting decisions. Export and a reviewed archive
migration are required before extending that bound. There is no automatic purge,
retraining, credential expansion, code modification, infrastructure action or payment.
The scheduler never calls the decision route. All outbound observations remain GET-only.

Decision exports are private evidence; do not commit real exports to the public repository.
The JSON contract and SQL support a future self-hosted adapter without changing the UI.
The current Access/D1 pilot remains a managed service, not a completed self-hosted migration.

## Daily behaviour

1. Observe on the existing inexpensive schedule.
2. Group evidence under stable findings or opportunities.
3. Route to the responsible department and state the expected independent review.
4. Present at most three decisions, incidents before research.
5. Retain founder reasons, execution status and measured outcomes separately.

Existing tab notifications remain opt-in and generic, only for new high-priority
findings while the authenticated tab is open. No new external messages or offline
push service are configured. Routine information stays in the feed.

## Next implementation phases

1. Review false positives and decision usefulness using actual founder feedback.
2. Connect a read-only, verified analytics/revenue source; avoid earnings estimates
   presented as actual revenue. Add structured customer experiments with audience,
   threshold, effort cap and stopping condition.
3. Install the self-hosted model adapter and independent watchdog on founder-owned
   infrastructure. Require per-investigation time/token limits, bounded retries,
   evidence citations, untrusted-input isolation and an explicit unavailable state.
4. Run backup/restore and outage exercises; migrate scheduler, authentication and
   evidence storage to the self-hosted deployment before claiming total ownership.
5. Permit proposed improvements to rules only after founder review and regression
   testing. Agent permissions remain observation/recommendation-only permanently.

## Release and rollback

Run Node worker/contract tests, SQLite migration tests and browser UI regression.
Build only the three allowlisted frontend assets. Preserve the current pilot's Access
bindings, Cron and Free-tier resource envelope. Apply the additive journal migration
only to the dedicated HQ database, then enable HQ_DECISIONS_ENABLED=true with the
reviewed pilot bundle. Never apply this migration to the public website database.
Rollback: restore the previous worker bundle or disable the journal flag. Retain the
new table and history; the old version does not use it. No destructive down migration.

## Verification and release status — continued readiness audit

**Overall status: NOT ready for full production launch.** Software implementation,
local verification and deployment are separate milestones. The private pilot was published
on 2026-11-15; migrations 0005 and 0006 were applied to its dedicated HQ database after
a SQL export was restored and checked successfully in an isolated SQLite database.

| Area | Current evidence | Status |
| --- | --- | --- |
| Founder workflow | Server-enforced decisions, evidence labels, feedback, three-item queue and three-opportunity cap | Implemented; locally tested; private pilot journal enabled |
| Customer experiments | Acceptance requires audience, problem, hypothesis, metric, positive target, <=40-hour effort cap, stop condition and review within 90 days | Implemented; locally tested |
| Portable runtime | Node 24 + SQLite reuses the same worker/decision logic and migrations; loopback-only password/session authentication and real logout | Implemented; local HTTP integration tests pass; not installed on a persistent host |
| Private model adapter | Fixed local endpoint; installed-local-model check; three attempts/day; 512-token limit; no retries/tools; stale evidence and invented citations rejected | Adapter tested with fixtures; no model connected, no actual inference verified |
| Backup and restore | Actual pilot SQL export restored locally; integrity and both migrations passed; private backup saved | Pre-release recovery rehearsal passed; recurring independent backup destination pending |
| Monitoring and watchdog | Existing bounded collector tests and independent watchdog tests | Regression-tested; independent persistent deployment pending |
| Browser UI | CI confirms navigation, imports, XSS defenses, founder save/reload/history and read-only browser checks | Passed Chromium, Firefox and WebKit: 14 widths, seven screens, menus and simulated logout navigation |
| Revenue / analytics | No authenticated actual source supplied | Not connected; actual revenue remains unknown |
| Founder feedback learning | Reasons and feedback retained, no automatic policy updates | Implemented history; real operational usefulness evaluation awaits founder use |
| Publication / pilot release | Published source in PR #6; private pilot bundle read back and matched | Private pilot deployed; founder decision saving enabled and settings read back |

Verification commands and deployment guidance: [self-hosted runtime](../selfhost/README.md).
The local Node test suite has **53 passing tests**. The Python regression suite has
**50 passing tests**, including private-inference failure cases, discovery, watchdog,
viewer authentication and backup/restore. Source QA and generated bundle checks pass.
Browser outcomes are tracked separately below. No live model result, destructive production restore or full-production readiness is claimed.

### Required to finish the full plan

1. A persistent founder-owned server and authorized connection, or an explicitly
   revised scope that keeps the current managed pilot. The transient workspace is not
   production infrastructure, and no server purchase has been made.
2. An installed local model with confirmed hardware fit and acceptable license, followed
   by real inference validation and persistent supervisor integration.
3. A genuine read-only analytics/revenue source, plus independent monitoring and private
   backup destinations. Code cannot manufacture business evidence or independent hosting.
4. Founder-session live save/reload and sign-out check. Isolated browser suites pass;
   this does not substitute for a live authenticated founder check.

The private HQ pilot has been updated; the public website remains unchanged. A rollback
retains the append-only journal rather than deleting founder history.


### Pilot journal release — 15 November 2026

- Release source: commit `37a466f4abfd7bc3deea18806c6215fd0c119b5f`, PR #6.
- CI run `43735637250`: all browser and offline checks passed; Worker verification
  run `43735636972` passed. Landscape status-badge overflow was fixed.
- Pilot deployment `9034d43c977146fb8b9e9ac5e1779df2`: updated bundle read back;
  existing Access/D1 bindings preserved; `HQ_DECISIONS_ENABLED=true` verified.
- Actual database export saved privately as `hq-pre-journal.sql`; restored into
  disposable SQLite, integrity checked, and migrations rehearsed before application.
- No synthetic founder decisions were inserted into the live journal.
- Local HTTP tests cover login, saved history, stale-revision rejection, pause and
  session invalidation. Browser tests cover save/reload, history, transition gating,
  imported-report write refusal and responsive layouts. Browser logout uses a fixture;
  live founder authentication and logout still require the founder session.
- Rollback: set `HQ_DECISIONS_ENABLED=false` while preserving all existing bindings.
  Retain journal tables and events. Do not restore the pre-release export over new history.
- Deployment settings are managed through the existing pilot API workflow. Preserve
  Access bindings and the journal flag on subsequent uploads; the source config alone
  does not contain all live authentication settings.
