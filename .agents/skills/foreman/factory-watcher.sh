#!/usr/bin/env bash
# factory-watcher.sh — polls GitHub for new issues and pokes the foreman agent
#
# Usage:
#   herdr pane split --current --direction down --cwd "$PWD" --no-focus
#   herdr pane run <pane-id> "bash .agents/skills/foreman/factory-watcher.sh [OPTIONS]"
#
# Options:
#   --interval <seconds>   Polling interval (default: 60)
#   --foreman <name>       Foreman agent name (default: foreman)
#   --quiet                Suppress heartbeat output

set -euo pipefail

INTERVAL=60
FOREMAN="foreman"
QUIET=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --interval) INTERVAL="$2"; shift 2 ;;
    --foreman)  FOREMAN="$2"; shift 2 ;;
    --quiet)    QUIET=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

export GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}"

echo "[watcher] Started — polling every ${INTERVAL}s, foreman=${FOREMAN}"

while true; do
  SYNC_OUTPUT=$(bd github sync --json 2>&1 || true)
  PULLED=$(echo "$SYNC_OUTPUT" | jq -r '.pulled // 0' 2>/dev/null || echo "0")

  if [[ "$PULLED" -gt 0 ]]; then
    READY_COUNT=$(bd ready --json 2>/dev/null | jq 'length' 2>/dev/null || echo "0")

    echo "[watcher] $(date +%H:%M:%S) — pulled $PULLED new issues, $READY_COUNT ready"

    herdr notification show "Factory: new work" \
      --body "$PULLED issues synced, $READY_COUNT ready" \
      --sound request 2>/dev/null || true

    # Only poke the foreman if there's ready work and the agent exists and is idle
    if [[ "$READY_COUNT" -gt 0 ]]; then
      FOREMAN_STATE=$(herdr agent get "$FOREMAN" 2>/dev/null | jq -r '.result.agent_status' 2>/dev/null || echo "missing")

      if [[ "$FOREMAN_STATE" == "idle" || "$FOREMAN_STATE" == "done" ]]; then
        echo "[watcher] Poking foreman..."
        herdr agent prompt "$FOREMAN" \
          "New work arrived. $READY_COUNT issues ready. Run the factory loop." \
          --wait --timeout 600000 2>/dev/null || true
      else
        echo "[watcher] Foreman is ${FOREMAN_STATE}, skipping poke"
      fi
    fi
  else
    $QUIET || echo "[watcher] $(date +%H:%M:%S) — no new issues"
  fi

  sleep "$INTERVAL"
done
