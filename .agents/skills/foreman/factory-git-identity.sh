#!/usr/bin/env bash
# factory-git-identity.sh — pin a factory worktree's git commit + push identity to
# the bot account that `gh` is already authenticated as, WITHOUT touching the
# host's global git config (your personal identity stays the default everywhere else).
#
# Usage:  bash factory-git-identity.sh <worktree-path>
#
# How it stays isolated:
#   * Enables `extensions.worktreeConfig` and writes identity + credential settings
#     with `git config --worktree`, so they live in THIS worktree's config only.
#     The main checkout and `--global` config are never modified.
#   * Commit author/committer  -> bot login + GitHub noreply email (from `gh api user`).
#   * Push credential          -> `gh auth git-credential`, overriding the host's
#     personal credential helper (e.g. git-credential-manager) for this worktree.
#   * Credential username      -> the bot login, so any credential store keys the bot
#     token under `git:https://<bot>@github.com` instead of the shared
#     `git:https://github.com` entry the host's personal account uses.
#
# Idempotent: safe to run more than once per worktree.
set -euo pipefail

WT="${1:?usage: factory-git-identity.sh <worktree-path>}"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  export GITHUB_TOKEN="$(gh auth token)"
fi

# --- resolve the bot identity from the gh-authenticated account ---
BOT_LOGIN="$(gh api user --jq '.login')"
BOT_ID="$(gh api user --jq '.id')"
BOT_EMAIL="${BOT_ID}+${BOT_LOGIN}@users.noreply.github.com"

# --- scope everything below to THIS worktree only ---
git -C "$WT" config --worktree --bool extensions.worktreeConfig true 2>/dev/null \
  || git -C "$WT" config extensions.worktreeConfig true

git -C "$WT" config --worktree user.name  "$BOT_LOGIN"
git -C "$WT" config --worktree user.email "$BOT_EMAIL"

# Override the host's personal credential helper for pushes from this worktree:
# an empty value resets the inherited (global) helper list, then gh is added.
git -C "$WT" config --worktree --replace-all credential.helper ""
git -C "$WT" config --worktree --add credential.helper '!gh auth git-credential'
git -C "$WT" config --worktree "credential.https://github.com.username" "$BOT_LOGIN"

echo "factory git identity for $WT:"
echo "  user.name         = $(git -C "$WT" config user.name)"
echo "  user.email        = $(git -C "$WT" config user.email)"
echo "  credential.helper = $(git -C "$WT" config --get-all credential.helper | tr '\n' ' ')"
echo "  credential user   = $(git -C "$WT" config 'credential.https://github.com.username')"
