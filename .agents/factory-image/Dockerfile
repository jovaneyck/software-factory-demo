# Factory agent sandbox image.
#
# Base: Microsoft Playwright image — ships Chromium + all OS deps preinstalled so
# workers can take proof-of-work screenshots inside the container. The tag's Playwright
# version is pinned to match the app's playwright dependency (app/package.json).
#
# Deliberately ABSENT (see specs/decisions.md, decision 8 — credential boundary):
#   - gh (GitHub CLI)
#   - bd (beads)
#   - GITHUB_TOKEN / git push credentials
# All GitHub/beads state changes are hoisted to the host-side feature-owner.
#
# Present: node, git, jq, ripgrep, and pi (the agent runtime). Inference auth
# (see .agents/factory-config.json) is provided at runtime by a run-local mounted
# auth.json, never baked into the image.

FROM mcr.microsoft.com/playwright:v1.58.2-jammy

# OS tooling the worker's shell workflow needs. The Playwright base already carries
# Chromium + its libs; we add the source-control / search / json utilities.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       git \
       curl \
       ca-certificates \
       jq \
       ripgrep \
    && rm -rf /var/lib/apt/lists/*

# The Playwright base runs as root and ships a non-root `pwuser`. Reuse it as the
# unprivileged agent identity. HOME must be a real, writable directory because pi
# stores state under $HOME/.pi.
ENV HOME=/home/pwuser
ENV PI_VERSION=0.84.4

# Install the agent runtime globally. Pin to the repo's pi version (see decisions.md).
RUN npm install -g @earendil-works/pi-coding-agent@${PI_VERSION} \
    && npm cache clean --force

# Prepare the pi state directory that the run-local auth.json will be mounted onto.
RUN mkdir -p /home/pwuser/.pi/agent \
    && chown -R pwuser:pwuser /home/pwuser

USER pwuser
WORKDIR /workspace

# Container is launched with an explicit command (`pi …`) by sandbox-run.sh.
# The default keeps `docker run <image>` inspectable without arguments.
CMD ["pi", "--version"]
