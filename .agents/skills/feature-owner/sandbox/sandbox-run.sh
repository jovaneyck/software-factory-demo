#!/usr/bin/env bash
# sandbox-run.sh — launch a command (normally `pi …`) inside a per-run Docker
# sandbox container, or directly on the host when sandboxing is disabled.
#
# This is the execution boundary for the worker (see specs/decisions.md). The
# feature-owner runs this in the worker's herdr pane instead of running `pi`
# directly. Herdr keeps controlling the agent via terminal-buffer scraping.
#
# The worktree (current directory, or --workspace) is bind-mounted at /workspace.
# A run-local copy of the host auth.json (the inference credential) is mounted
# at /home/pwuser/.pi/agent. NO GitHub credentials enter the container.
#
# Usage:
#   sandbox-run.sh --run-id <id> [--workspace <path>] [--config <path>] [--tier <name>] -- <command> [args...]
#
# Example (what the feature-owner sends to the pane):
#   sandbox-run.sh --run-id 5 --tier worker -- pi --session-id worker-5 --name 'worker' --skill ...
#
# --tier <name> resolves tiers.<name> from the factory config and injects
# `--model <resolved>` into the pi command automatically. This is the ROBUST way
# to set the worker model: the caller (a possibly-weak feature-owner model) never
# has to read/interpolate the model string itself, so it can't spawn the worker on
# the wrong tier (e.g. copying the foreman's opus line out of the config dump).

set -euo pipefail
# Docker Desktop on Windows + MSYS/Git Bash mangles absolute paths in arguments.
# Disable MSYS path conversion; we translate paths explicitly below.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

RUN_ID=""
WORKSPACE="$PWD"
CONFIG=".agents/factory-config.json"
TIER=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id)    RUN_ID="$2"; shift 2 ;;
    --workspace) WORKSPACE="$2"; shift 2 ;;
    --config)    CONFIG="$2"; shift 2 ;;
    --tier)      TIER="$2"; shift 2 ;;
    --) shift; break ;;
    *) echo "ERROR: unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$RUN_ID" ]]; then echo "ERROR: --run-id is required" >&2; exit 2; fi
if [[ $# -eq 0 ]]; then echo "ERROR: no command given after --" >&2; exit 2; fi

# --- Load config (via node, not jq — see config-get.sh) ----------------------
if [[ ! -f "$CONFIG" ]]; then echo "ERROR: config not found: $CONFIG" >&2; exit 2; fi
cfg() { bash "$SCRIPT_DIR/config-get.sh" "$CONFIG" "$1" "$2"; }

ENABLED=$(cfg sandbox.enabled false)
IMAGE=$(cfg sandbox.image software-factory-agent:latest)
CPUS=$(cfg sandbox.limits.cpus 2)
MEMORY=$(cfg sandbox.limits.memory 4g)
PIDS=$(cfg sandbox.limits.pids 512)
NETWORK=$(cfg sandbox.network default)
# node_modules acceleration: on Windows/macOS the worktree is a slow bind mount, so
# keeping node_modules on it makes npm install + vitest crawl (thousands of tiny file
# reads cross the Docker fs-translation layer). Shadow each node_modules dir with a
# tmpfs so that IO happens in-memory on the container side. tmpfs (not an anonymous
# volume) because an empty volume mounts root-owned while the sandbox runs as the
# non-root pwuser (uid 1000) — tmpfs lets us set uid/gid directly, no root/CAP_CHOWN
# needed (the security posture drops all caps). Size is a ceiling, not a reservation.
NM_CACHE_ENABLED=$(cfg sandbox.nodeModulesCache.enabled false)
NM_CACHE_SIZE=$(cfg sandbox.nodeModulesCache.tmpfsSize 1g)
NM_CACHE_PATHS=$(cfg sandbox.nodeModulesCache.paths "")

# --- Resolve --tier into an injected --model ---------------------------------
# When --tier <name> is given, resolve tiers.<name> from the config and splice
# `--model <resolved>` in right after the launched program (the first arg after
# `--`, normally `pi`). This makes the sandbox launcher the single source of
# truth for the worker's model, so a weak feature-owner can't hardcode the wrong
# one. If the caller ALSO passed --model, we leave theirs alone (explicit wins).
if [[ -n "$TIER" ]]; then
  TIER_MODEL=$(cfg "tiers.$TIER" "")
  if [[ -z "$TIER_MODEL" ]]; then
    echo "ERROR: --tier '$TIER' not found in $CONFIG (tiers.$TIER)" >&2; exit 2
  fi
  # Does the command already specify --model? If so, respect it.
  HAS_MODEL=0
  for a in "$@"; do [[ "$a" == "--model" ]] && HAS_MODEL=1 && break; done
  if [[ "$HAS_MODEL" -eq 0 ]]; then
    PROG="$1"; shift
    set -- "$PROG" --model "$TIER_MODEL" "$@"
    echo "[sandbox] tier=$TIER -> --model $TIER_MODEL" >&2
  else
    echo "[sandbox] tier=$TIER ignored (command already has --model)" >&2
  fi
fi

# --- Disabled path: run directly on the host (decision 9: "none") ------------
if [[ "$ENABLED" != "true" ]]; then
  echo "[sandbox] disabled — running on host: $*" >&2
  exec "$@"
fi

# --- Prepare run-local inference auth ----------------------------------------
DATA_DIR="${SOFTWARE_FACTORY_DATA_DIR:-$HOME/.software-factory}"
RUN_PI_DIR="$DATA_DIR/runs/$RUN_ID/sandbox/pi"
bash "$SCRIPT_DIR/prepare-pi-auth.sh" "$RUN_PI_DIR" >/dev/null

# --- Translate host paths for Docker Desktop bind mounts ---------------------
# Docker Desktop wants Windows-style paths (C:/Users/...). cygpath handles the
# MSYS -> Windows conversion; fall back to the raw path on non-Windows.
to_docker_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    echo "$1"
  fi
}
WORKSPACE_DOCKER=$(to_docker_path "$WORKSPACE")
RUN_PI_DIR_DOCKER=$(to_docker_path "$RUN_PI_DIR")

CONTAINER_NAME="factory-${RUN_ID}"

# --- Network flag ------------------------------------------------------------
NET_ARGS=()
if [[ "$NETWORK" == "none" ]]; then
  NET_ARGS=(--network none)
fi

echo "[sandbox] run=$RUN_ID image=$IMAGE workspace=$WORKSPACE_DOCKER net=$NETWORK" >&2
echo "[sandbox] container=$CONTAINER_NAME cpus=$CPUS mem=$MEMORY pids=$PIDS" >&2

# --- node_modules acceleration (tmpfs, uid-owned by the non-root sandbox user) --
NODE_MODULES_ARGS=()
if [[ "$NM_CACHE_ENABLED" == "true" && -n "$NM_CACHE_PATHS" ]]; then
  IFS=',' read -ra _NM_PATHS <<< "$NM_CACHE_PATHS"
  for _p in "${_NM_PATHS[@]}"; do
    _p="$(echo "$_p" | tr -d '[:space:]')"
    [[ -z "$_p" ]] && continue
    # NOTE: docker --tmpfs defaults to noexec,nosuid,nodev. node_modules holds
    # executables (.bin shims, esbuild's platform binary whose postinstall
    # exec-checks its version, etc.), so we MUST add `exec` or npm install
    # thrashes: broken esbuild -> postinstall errors -> rm -rf on a busy mount.
    NODE_MODULES_ARGS+=(--tmpfs "/workspace/${_p}:exec,uid=1000,gid=1000,size=${NM_CACHE_SIZE}")
  done
  echo "[sandbox] node_modules tmpfs (${NM_CACHE_SIZE}): ${_NM_PATHS[*]}" >&2
fi

# --- TTY: interactive agents (herdr panes) need -t so pi renders its TUI and herdr
# can scrape the buffer. Headless contexts (CI, this test harness) have no TTY, so
# fall back to -i only to avoid "the input device is not a TTY".
if [[ -t 0 ]]; then TTY_FLAG=(-it); else TTY_FLAG=(-i); fi

# --- Herdr agent-kind hint (sandbox wrapper) --------------------------------
# The pane's foreground process is `docker` (this wrapper), which hides `pi` from
# herdr's process-based agent detection — herdr sees an agent UI but can't classify
# the kind (shows agent_status "unknown"). Per herdr's "VMs and sandbox wrappers"
# docs, set HERDR_AGENT=<kind> on the HOST wrapper process (not inside the
# container) so herdr applies that agent's screen manifest to the pane buffer.
# Hint the kind only when we're actually launching a known agent.
case "${1:-}" in
  pi|pidev) export HERDR_AGENT=pi ;;
esac

# --- Launch: foreground, auto-removed, TTY so herdr can scrape the buffer ----
exec docker run --rm "${TTY_FLAG[@]}" \
  --name "$CONTAINER_NAME" \
  --label software-factory.sandbox=true \
  --label "software-factory.run-id=$RUN_ID" \
  --workdir /workspace \
  --mount "type=bind,src=${WORKSPACE_DOCKER},dst=/workspace" \
  --mount "type=bind,src=${RUN_PI_DIR_DOCKER},dst=/home/pwuser/.pi/agent" \
  "${NODE_MODULES_ARGS[@]}" \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit "$PIDS" \
  --memory "$MEMORY" \
  --cpus "$CPUS" \
  --tmpfs /tmp:size=1g \
  -e HOME=/home/pwuser \
  "${NET_ARGS[@]}" \
  "$IMAGE" \
  "$@"
