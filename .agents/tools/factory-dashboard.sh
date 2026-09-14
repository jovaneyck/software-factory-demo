#!/usr/bin/env bash
# factory-dashboard.sh — live-refreshing wrapper around factory-dashboard.js
#
# Usage:
#   bash .agents/tools/factory-dashboard.sh              # refresh every 5s, herdr+beads only
#   bash .agents/tools/factory-dashboard.sh --signals    # also scrape FACTORY: signals (slower)
#   bash .agents/tools/factory-dashboard.sh -i 10        # refresh every 10s
#
# Ctrl-C to quit. Runs one-shot if stdout is not a TTY.

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERVAL=5
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--interval) INTERVAL="$2"; shift 2 ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

# One-shot when piped/redirected.
if [[ ! -t 1 ]]; then
  node "$DIR/factory-dashboard.js" "${ARGS[@]}"
  exit $?
fi

trap 'printf "\033[?25h"; exit 0' INT TERM   # restore cursor on quit
printf "\033[?25l"                            # hide cursor
while true; do
  OUT="$(node "$DIR/factory-dashboard.js" "${ARGS[@]}" 2>&1)"
  printf "\033[H\033[2J"                       # home + clear
  printf "%s\n" "$OUT"
  printf "\033[2m  refresh %ss · Ctrl-C to quit\033[0m\n" "$INTERVAL"
  sleep "$INTERVAL"
done
