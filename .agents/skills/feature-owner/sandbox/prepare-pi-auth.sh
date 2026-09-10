#!/usr/bin/env bash
# prepare-pi-auth.sh — copy the host's canonical Pi/Copilot auth.json into a
# run-local directory that will be mounted into the sandbox container.
#
# See specs/decisions.md, decision 6 (auth-only, run-local copy). The canonical
# host credential is never mounted, never modified, never symlinked. Each run gets
# its own physical copy at mode 0600.
#
# Usage:
#   prepare-pi-auth.sh <run-pi-dir> [<source-auth-json>]
#
# On success prints the absolute path to the copied auth.json.

set -euo pipefail

RUN_PI_DIR="${1:?usage: prepare-pi-auth.sh <run-pi-dir> [source-auth-json]}"
SRC_AUTH="${2:-$HOME/.pi/agent/auth.json}"

if [[ ! -f "$SRC_AUTH" ]]; then
  echo "ERROR: Pi auth.json not found at: $SRC_AUTH" >&2
  echo "       The sandbox needs Copilot inference credentials. Run 'pi' once on the host to authenticate." >&2
  exit 1
fi

mkdir -p "$RUN_PI_DIR"
chmod 700 "$RUN_PI_DIR" 2>/dev/null || true

cp "$SRC_AUTH" "$RUN_PI_DIR/auth.json"
chmod 600 "$RUN_PI_DIR/auth.json" 2>/dev/null || true

echo "$RUN_PI_DIR/auth.json"
