#!/usr/bin/env bash
# build-image.sh — build the factory agent sandbox image.
#
# Reads the image tag from .agents/factory-config.json (.sandbox.image) and builds
# .agents/factory-image/Dockerfile. Run once from the repo root (the factory
# bootstrap calls this), and again whenever the Dockerfile changes.
#
# Usage:
#   build-image.sh [--config <path>]

set -euo pipefail
export MSYS_NO_PATHCONV=1

CONFIG=".agents/factory-config.json"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2 ;;
    *) echo "ERROR: unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$CONFIG" ]]; then echo "ERROR: config not found: $CONFIG" >&2; exit 2; fi

IMAGE=$(bash "$(dirname "${BASH_SOURCE[0]}")/config-get.sh" "$CONFIG" sandbox.image software-factory-agent:latest)
DOCKERFILE=".agents/factory-image/Dockerfile"

if [[ ! -f "$DOCKERFILE" ]]; then echo "ERROR: Dockerfile not found: $DOCKERFILE" >&2; exit 2; fi

echo "[build] building $IMAGE from $DOCKERFILE ..."
docker build -t "$IMAGE" -f "$DOCKERFILE" .agents/factory-image
echo "[build] done: $IMAGE"
docker images "$IMAGE" --format '  {{.Repository}}:{{.Tag}}  {{.Size}}'
