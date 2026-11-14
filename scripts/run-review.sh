#!/usr/bin/env bash
# Read-only quality review runner. Never edits tracked files, creates a commit,
# posts PR comments, deploys code, or auto-fixes findings.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
umask 077
REPORTS="$ROOT/.review-tools/reports"
BIN="$ROOT/.review-tools/bin"
mkdir -p "$REPORTS"

mode="${1:---quick}"
if [[ "$mode" != "--quick" && "$mode" != "--full" ]]; then
  echo "Usage: bash scripts/run-review.sh [--quick|--full]" >&2
  exit 2
fi
command -v node >/dev/null || { echo "BLOCKED: Node.js 22+ is required." >&2; exit 2; }
command -v python3 >/dev/null || { echo "BLOCKED: Python 3 is required." >&2; exit 2; }

echo "[1/4] Unit-testing review rules..."
node --test tests/quality.test.mjs

echo "[2/4] Validating JS, DOM, navigation and dangerous sinks..."
set +e
node scripts/qa-check.mjs --rdjsonl > "$REPORTS/quality.rdjsonl"
quality_result=$?
set -e
if [[ -x "$BIN/reviewdog" ]]; then
  "$BIN/reviewdog" -f=rdjsonl -reporter=local -filter-mode=nofilter < "$REPORTS/quality.rdjsonl"
else
  echo "NOTICE: reviewdog binary not installed; raw findings saved to quality.rdjsonl"
  cat "$REPORTS/quality.rdjsonl"
  if [[ "$mode" == "--full" ]]; then
    echo "BLOCKED: reviewdog missing. Run python3 scripts/bootstrap-review-bots.py" >&2
    exit 2
  fi
fi
if (( quality_result != 0 )); then
  echo "FAIL: deterministic reviewer found blocking issues." >&2
  exit 1
fi

echo "[3/4] Running real Chromium browser smoke tests..."
python3 tests/ui_smoke.py

if [[ "$mode" == "--quick" ]]; then
  echo "QUICK REVIEW COMPLETE: deterministic and browser checks ran."
  echo "Not run: secret scanning, vulnerability DB scanning, AI review."
  exit 0
fi

echo "[4/4] Running installed self-hosted secret and vulnerability scanners..."
for tool in betterleaks trivy; do
  if [[ ! -x "$BIN/$tool" ]]; then
    echo "BLOCKED: $tool missing; install verified releases before full review." >&2
    exit 2
  fi
done

# Reports can include sensitive findings: always store under ignored directory
# and never upload by default. Findings must be reviewed and redacted manually.
"$BIN/betterleaks" dir index.html styles.css dashboard.js scripts tests \
  --report-path "$REPORTS/betterleaks-working-tree.json" --report-format json
"$BIN/betterleaks" git . \
  --report-path "$REPORTS/betterleaks-git-history.json" --report-format json
"$BIN/trivy" fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL \
  --exit-code 1 --skip-dirs "$ROOT/.review-tools" --format json \
  --output "$REPORTS/trivy.json" "$ROOT"
echo "FULL REVIEW COMPLETE. Inspect private local reports in $REPORTS"
echo "This does not prove there are no vulnerabilities; only the selected checks passed."
