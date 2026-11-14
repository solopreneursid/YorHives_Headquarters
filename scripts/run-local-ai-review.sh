#!/usr/bin/env bash
# Opt-in local code review using the open-source PR-Agent + a self-hosted Ollama
# model. No GitHub token. No hosted PR comments. Never merges or deploys.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
umask 077
VENV="$ROOT/.review-tools/pr-agent-venv"
REPORTS="$ROOT/.review-tools/reports"
mkdir -p "$REPORTS"
mode="${1:---review}"
if [[ "$mode" == "--install" ]]; then
  command -v python3 >/dev/null || { echo "Python 3 is required" >&2; exit 2; }
  python3 -m venv "$VENV"
  "$VENV/bin/python" -m pip install --disable-pip-version-check "pr-agent==0.50.0"
  echo "PR-Agent v0.50.0 installed locally (not running)."
  exit 0
fi
if [[ "$mode" != "--review" ]]; then
  echo "Usage: bash scripts/run-local-ai-review.sh [--install|--review]" >&2
  exit 2
fi
if [[ ! -x "$VENV/bin/python" ]]; then
  echo "BLOCKED: install PR-Agent with: bash scripts/run-local-ai-review.sh --install" >&2
  exit 2
fi
command -v curl >/dev/null || { echo "BLOCKED: curl required to check local Ollama" >&2; exit 2; }
if ! curl --silent --show-error --fail --max-time 3 http://127.0.0.1:11434/api/tags > "$REPORTS/ollama-models.json"; then
  echo "BLOCKED: local Ollama not available on 127.0.0.1:11434. No AI review performed." >&2
  exit 2
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "BLOCKED: tracked checkout must be clean. Agent reviews committed changes only." >&2
  exit 2
fi
if ! git show-ref --verify --quiet refs/heads/main; then
  echo "BLOCKED: local main branch required for diff target." >&2
  exit 2
fi
# Explicit host-owned configuration keeps output in an ignored evidence directory.
# Do not run this on an untrusted checkout with write-enabled credentials.
CONFIG="$ROOT/.review-tools/local-pr-agent.toml"
printf '[local]\nreview_path = "%s"\n' "$REPORTS/pr-agent-review.md" > "$CONFIG"
export CONFIG__GIT_PROVIDER=local
export CONFIG__MODEL="ollama/qwen2.5-coder:7b"
export CONFIG__FALLBACK_MODELS="[]"
export CONFIG__CUSTOM_MODEL_MAX_TOKENS=8192
export CONFIG__PROPAGATE_COMMAND_ERRORS=true
export OLLAMA__API_BASE="http://127.0.0.1:11434"
"$VENV/bin/python" -m pr_agent.cli --pr_url main \
  --extra_config_url "$CONFIG" review
if [[ ! -s "$REPORTS/pr-agent-review.md" ]]; then
  echo "BLOCKED: PR-Agent did not produce an evidence report." >&2
  exit 1
fi
echo "Local AI review generated: $REPORTS/pr-agent-review.md"
echo "It is an opinionated model review, not verified security evidence or approval."
