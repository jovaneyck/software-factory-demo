#!/usr/bin/env bash
# config-get.sh — read a dotted key from a JSON config file using node.
#
# We use node (guaranteed present — it's the pi runtime) instead of jq, which is
# not reliably on PATH in the factory's Git Bash panes.
#
# Usage:
#   config-get.sh <config.json> <dotted.key> [default]
# Example:
#   config-get.sh .agents/factory-config.json sandbox.image software-factory-agent:latest

set -euo pipefail

CONFIG="${1:?usage: config-get.sh <config.json> <dotted.key> [default]}"
KEY="${2:?missing key}"
DEFAULT="${3:-}"

node -e '
  const [file, key, def] = process.argv.slice(1);
  let v;
  try {
    const cfg = require("fs").readFileSync(file, "utf8");
    v = key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), JSON.parse(cfg));
  } catch (e) { v = undefined; }
  process.stdout.write(v === undefined || v === null ? def : String(v));
' "$CONFIG" "$KEY" "$DEFAULT"
