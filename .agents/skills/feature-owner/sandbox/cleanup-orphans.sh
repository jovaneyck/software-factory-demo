#!/usr/bin/env bash
# cleanup-orphans.sh — remove stale factory sandbox containers.
#
# See specs/decisions.md, decision 11 (crash recovery). Enumerates only containers
# labeled software-factory.sandbox=true. Never touches unrelated containers.
#
# Because sandbox containers run with --rm in the foreground of a herdr pane, a
# normally-exited or cancelled run removes its own container. This script cleans up
# containers left behind by a hard crash (host reboot, herdr kill -9, etc.).
#
# Usage:
#   cleanup-orphans.sh           # remove exited/dead factory containers (safe default)
#   cleanup-orphans.sh --all     # also stop+remove RUNNING factory containers
#   cleanup-orphans.sh --run-id <id>   # remove the container for one run, any state

set -euo pipefail
export MSYS_NO_PATHCONV=1

MODE="exited"
RUN_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) MODE="all"; shift ;;
    --run-id) MODE="run"; RUN_ID="$2"; shift 2 ;;
    *) echo "ERROR: unknown arg: $1" >&2; exit 2 ;;
  esac
done

LABEL_FILTER="label=software-factory.sandbox=true"

case "$MODE" in
  run)
    ids=$(docker ps -aq --filter "$LABEL_FILTER" --filter "label=software-factory.run-id=$RUN_ID")
    ;;
  all)
    ids=$(docker ps -aq --filter "$LABEL_FILTER")
    ;;
  exited)
    # Only containers that are no longer running.
    ids=$(docker ps -aq --filter "$LABEL_FILTER" --filter "status=exited" --filter "status=dead" --filter "status=created")
    ;;
esac

if [[ -z "${ids//[[:space:]]/}" ]]; then
  echo "[cleanup] no orphaned factory containers found (mode=$MODE)"
  exit 0
fi

echo "[cleanup] removing containers (mode=$MODE):"
docker ps -a --filter "$LABEL_FILTER" --format '  {{.Names}}\t{{.Status}}'

# shellcheck disable=SC2086
docker rm -f $ids
echo "[cleanup] done"
