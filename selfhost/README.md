# Founder-owned runtime (deployment not yet performed)

The Node 24+ adapter reuses the existing Worker logic, SQLite-compatible migrations,
900 GET/day budget and founder decision journal. There are no npm dependencies.
It binds only to 127.0.0.1 and provides password login, expiring server-side sessions,
HttpOnly/SameSite cookies, login rate limits and real logout. Browser requests cannot
supply the trusted internal identity. The internal reserved email is an adapter ID,
not an external account. No Cloudflare Access, D1 or cloud API is required to run it.

## Local startup on a founder-owned Linux server

From this repository checkout, with Node 24+ and Python 3 installed:

```bash
umask 077
read -rsp 'Choose the founder password (at least 24 characters): ' HQ_OWNER_PASSWORD
export HQ_OWNER_PASSWORD
export HQ_STATE_DIR="$HOME/.local/state/yorphives-runtime"
node selfhost/runtime.mjs
```

Open `http://127.0.0.1:8765` on that server. For another device, use an authenticated
SSH tunnel. Keep the browser URL as **127.0.0.1**, because the Host allowlist deliberately
rejects arbitrary names. Do not expose this HTTP listener on a public interface.
No HTTP cookie is marked Secure on loopback; network transport must be an SSH tunnel.
Startup runs bounded observation scans. The source checkout is not an evidence store.
The password is supplied via process environment; protect the account and service
configuration. Persistent system-service installation requires the actual server,
its account, source location and state location; none is currently connected.

## Local verification

```bash
node --test selfhost/runtime.test.mjs cloudflare/tests/*.test.mjs tests/quality.test.mjs
python3 tests/test_private_operations.py
node scripts/qa-check.mjs
```

Tests use temporary databases and fixture-only passwords. No live credentials or
real founder decisions are seeded. Browser-engine testing is a separate requirement.

## Backups and restore rehearsal

With the runtime state directory above:

```bash
python3 intelligence/recovery.py backup "$HOME/.local/state/yorphives-runtime/hq-runtime.sqlite" \
  --destination "$HOME/.local/state/yorphives-backups/hq-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
```

The backup prints its filename, checksum and table counts. Use `recovery.py rehearse`
on that backup's full path to verify a fresh temporary restored database without
modifying the live database. Existing backup files are never overwritten. Backups
must remain private and should be copied to founder-owned independent storage.
A same-host backup alone is not disaster recovery. The included test rehearses real
SQLite backup and restore; it is not evidence that production backups are scheduled.

## Private inference adapter

`intelligence/private_inference.py` only contacts `127.0.0.1:11434`. It validates an
already installed local model through `/api/tags`, rejects remote/cloud model metadata,
and submits a bounded `/api/chat` request. No model is downloaded or chosen automatically.
Reference: https://docs.ollama.com/api/chat and https://docs.ollama.com/api/tags .

It accepts a collector report, an external private state directory and an exact model
name via `--report`, `--state-dir` and `--model`. The server/model is NOT provisioned.
There are at most three attempts per UTC day, 512 output tokens per request, five
seconds for local model inventory and 30 seconds for inference. Evidence is capped
at five records/8,000 characters. Repeated evidence is cached for the day. Failed
attempts consume budget; no retry loop or cloud fallback exists. A production process
supervisor should also enforce a 40-second wall-time limit on the invocation.

The adapter writes `private-analysis.json` outside the checkout, labelled unverified
model inference. The current dashboard does not turn this output into verified findings
or automatic actions. Integration into a persistent supervisor and independent review
remain deployment work. No tool execution, shell, deployment, payments or source-write
capability is exposed to the model.

## Remaining deployment requirements

- Founder-owned persistent machine and authorized connection.
- Exact locally installed model, hardware fit and license approval.
- Private state, backup destination and process-supervisor installation.
- An independent monitoring host; existing `intelligence/watchdog.py` is source only.
- Genuine analytics/revenue evidence and a read-only integration; unknown revenue stays null.
- Successful browser regression and real authenticated release verification.

Do not use the transient ChatGPT workspace as the company's production server.
