#!/usr/bin/env bash
# factory-watcher.sh — polls GitHub for new issues and pokes the foreman agent
#
# Setup (from the foreman's pane or any shell):
#   herdr pane split --current --direction down --cwd "$PWD" --no-focus
#   herdr pane run <pane-id> "bash .agents/skills/foreman/factory-watcher.sh"
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

LAST_READY_COUNT=$(bd ready --json 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
echo "[watcher] Baseline: $LAST_READY_COUNT ready issues"

while true; do
  sleep "$INTERVAL"

  # Sync with GitHub (ignore warnings on stderr)
  bd github sync >/dev/null 2>&1 || true

  # Count ready issues after sync
  READY_COUNT=$(bd ready --json 2>/dev/null | jq 'length' 2>/dev/null || echo "0")

  if [[ "$READY_COUNT" -gt "$LAST_READY_COUNT" ]]; then
    NEW_WORK=$(( READY_COUNT - LAST_READY_COUNT ))
    echo "[watcher] $(date +%H:%M:%S) — $NEW_WORK new ready issue(s), $READY_COUNT total ready"

    herdr notification show "Factory: $NEW_WORK new issue(s)" \
      --body "$READY_COUNT issues ready for work" \
      --sound request 2>/dev/null || true

    # Only poke the foreman if it exists and is idle
    FOREMAN_STATE=$(herdr agent get "$FOREMAN" 2>/dev/null \
      | jq -r '.result.agent_status' 2>/dev/null || echo "missing")

    if [[ "$FOREMAN_STATE" == "idle" || "$FOREMAN_STATE" == "done" ]]; then
      echo "[watcher] Poking foreman..."
      # NOTE: send an explicit instruction, NOT the bare "/factory" string.
      # agent prompt injects raw text (no TUI slash-command expansion), and because
      # pi auto-discovers every project skill, bare "/factory" gets semantically
      # matched to the start-factory operator skill instead of running the foreman
      # loop. Pin it to the foreman skill explicitly.
      herdr agent prompt "$FOREMAN" \
        "You are the foreman. Follow ONLY your foreman skill (.agents/skills/foreman). Do NOT use the start-factory skill. Run one factory pass now: sync GitHub, reconcile, find ready work, then claim -> worktree -> spawn feature-owner -> hand off -> monitor -> report. Start now." \
        --wait --timeout 600000 2>/dev/null || true
      echo "[watcher] Foreman finished processing"
    else
      echo "[watcher] Foreman is ${FOREMAN_STATE}, skipping poke"
    fi
  else
    $QUIET || echo "[watcher] $(date +%H:%M:%S) — no new issues (${READY_COUNT} ready)"
  fi

  # Update baseline (account for issues closed by foreman too)
  LAST_READY_COUNT=$(bd ready --json 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
done
