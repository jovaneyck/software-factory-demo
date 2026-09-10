# Docker Sandboxing for Agent Runs

## Goal

Add Docker-based sandbox execution to the software factory.

The factory already:

* uses Git worktrees for per-run filesystem isolation
* uses `pidev` / Pi as the agent harness
* stores application state on the filesystem
* authenticates Pi through GitHub Copilot rather than an API key

The Docker sandbox must ensure that agent shell/filesystem activity happens inside a disposable container while preserving the existing worktree-based run lifecycle.

Do not redesign the Git/worktree system.

Do not introduce a remote sandbox provider.

Do not introduce a secrets broker or credential proxy.

For Pi authentication, copy the existing Pi `auth.json` into a run-specific directory that is mounted into the container.

---

# Desired Architecture

```text
Vite frontend
      |
      v
Node backend
      |
      v
existing run orchestration
      |
      +---- Git worktree
      |
      v
DockerSandbox
      |
      v
per-run Docker container
      |
      +---- /workspace
      |       -> existing Git worktree
      |
      +---- /home/agent/.pi/agent/auth.json
              -> copied run-local auth.json

Pi / pidev runs inside the container.
```

The container is the execution boundary.

The Git worktree remains the repository isolation mechanism.

---

# Core Design

Introduce a sandbox abstraction so the rest of the factory does not depend directly on Docker.

Suggested interface:

```ts
export interface SandboxExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
  stdin?: NodeJS.ReadableStream;

  onStdout?: (chunk: Buffer) => void;
  onStderr?: (chunk: Buffer) => void;
}

export interface SandboxExecResult {
  exitCode: number;
}

export interface Sandbox {
  id: string;

  exec(
    command: string[],
    options?: SandboxExecOptions,
  ): Promise<SandboxExecResult>;

  stop(): Promise<void>;
  destroy(): Promise<void>;
}

export interface SandboxCreateOptions {
  runId: string;
  workspacePath: string;
}

export interface SandboxProvider {
  create(options: SandboxCreateOptions): Promise<Sandbox>;
}
```

Implement:

```text
SandboxProvider
└── DockerSandboxProvider
```

Avoid leaking Docker-specific concepts into higher-level run orchestration.

---

# Run Lifecycle

Existing conceptual lifecycle:

```text
create run
    |
create Git worktree
    |
run Pi
    |
collect result
    |
merge/persist/etc.
    |
cleanup worktree
```

Change it to:

```text
create run
    |
create Git worktree
    |
prepare sandbox runtime directory
    |
copy Pi auth.json
    |
create Docker container
    |
run Pi inside Docker
    |
stop/destroy Docker container
    |
existing result/merge handling
    |
cleanup sandbox runtime directory
    |
cleanup worktree
```

Container cleanup must occur in a `finally` path.

A failed Pi invocation must not leave a running container behind.

---

# Filesystem Layout

Use run-specific sandbox state outside the worktree.

Example:

```text
<data-dir>/
  runs/
    <run-id>/
      ...
      sandbox/
        pi/
          auth.json
```

The existing worktree lives wherever the factory currently stores it.

Do not move the worktree into the sandbox directory merely to support Docker.

The two host paths mounted into the container are:

```text
HOST WORKTREE
    ->
/workspace

<data-dir>/runs/<run-id>/sandbox/pi
    ->
/home/agent/.pi/agent
```

No parent application storage directory should be mounted.

---

# Pi Authentication

The host already contains a working Pi authentication file for GitHub Copilot.

Determine the existing Pi auth path from the application's existing configuration or Pi conventions.

Expected source resembles:

```text
~/.pi/agent/auth.json
```

Before starting the container:

```ts
await fs.mkdir(runPiDir, {
  recursive: true,
  mode: 0o700,
});

await fs.copyFile(
  sourcePiAuthPath,
  path.join(runPiDir, "auth.json"),
);
```

Set restrictive permissions where supported:

```ts
await fs.chmod(
  path.join(runPiDir, "auth.json"),
  0o600,
);
```

Do not mount the host's canonical Pi auth directory directly.

Do not mount the user's home directory.

Do not symlink to the original credential.

Each run receives its own physical copy.

The container mount is:

```text
<run sandbox>/pi
    ->
/home/agent/.pi/agent
```

Make this mount writable because Pi may refresh or update OAuth state.

Changes made to the run-local copy do not need to be propagated back to the canonical host credential as part of this implementation.

If authentication expires and Pi cannot recover using the copied credential, fail the run with a useful authentication error.

Do not implement credential synchronization in this task.

---

# Container Image

Add or define a factory agent image.

It must contain at minimum:

* Node version required by the project
* `git`
* shell utilities Pi requires
* `pidev` / Pi runtime
* any existing factory-required agent dependencies
* an unprivileged `agent` user

Example shape:

```dockerfile
FROM node:22-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       git \
       curl \
       ca-certificates \
       jq \
       ripgrep \
    && rm -rf /var/lib/apt/lists/*

RUN useradd \
    --create-home \
    --uid 1000 \
    --shell /bin/bash \
    agent

# Install whichever Pi/pidev packages the factory currently uses.
# Preserve existing package/version choices.

USER agent
WORKDIR /workspace

CMD ["sleep", "infinity"]
```

Do not blindly change the project's Node/Pi versions. Derive them from the existing repository.

---

# Container Creation

Create one container per factory run.

Conceptual Docker invocation:

```bash
docker run \
  --detach \
  --name "factory-<run-id>" \
  --workdir /workspace \
  --mount type=bind,src=<worktree>,dst=/workspace \
  --mount type=bind,src=<run-pi-dir>,dst=/home/agent/.pi/agent \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 512 \
  --memory 4g \
  --cpus 2 \
  --tmpfs /tmp:size=1g \
  <factory-agent-image> \
  sleep infinity
```

Exact memory, CPU, and PID defaults should live in configuration rather than being scattered through the implementation.

Suggested defaults:

```ts
const DEFAULT_SANDBOX_LIMITS = {
  cpus: 2,
  memory: "4g",
  pids: 512,
};
```

---

# User Identity and Worktree Permissions

The agent must be able to modify the bind-mounted Git worktree.

Avoid creating files owned by an unexpected UID on the host.

Prefer running the container using the host factory process UID/GID:

```bash
--user <process.getuid()>:<process.getgid()>
```

However, Pi expects a working home directory.

Set:

```text
HOME=/home/agent
```

and ensure `/home/agent` and required writable directories are usable by the runtime UID.

If the existing deployment environment makes dynamic UID/GID execution impractical, implement the smallest reliable ownership strategy compatible with the factory's current filesystem permissions.

Do not run agent workloads as root merely to avoid permissions problems.

---

# Security Defaults

The Docker provider should default to:

```text
non-root user
capabilities dropped
no-new-privileges
CPU limit
memory limit
PID limit
isolated /tmp
only explicit bind mounts
```

Never mount:

```text
/
/home
~
/var/run/docker.sock
the factory source directory
the application's complete storage directory
SSH directories
other projects
other run directories
```

Only the current worktree and current run's Pi state should be host-mounted.

---

# Network Policy

For the first implementation, support:

```ts
type SandboxNetworkMode =
  | "default"
  | "none";
```

Default should be configurable.

GitHub Copilot/Pi requires outbound network access, so Pi runs using:

```text
default
```

Do not implement domain-level egress filtering as part of this task.

Ensure Docker network settings are centralized so a stricter provider can be added later.

---

# Executing Commands

Do not run agent commands directly on the host once sandbox mode is enabled.

All Pi execution must flow through:

```ts
sandbox.exec(...)
```

For example:

```ts
await sandbox.exec(
  ["pidev", "...existing args"],
  {
    cwd: "/workspace",
    env: {
      HOME: "/home/agent",
    },
    signal,
    onStdout,
    onStderr,
  },
);
```

Prefer argument arrays over constructing shell strings.

The implementation may use either:

```text
docker exec
```

through `child_process.spawn()`

or the Docker Engine API.

Prefer the Docker CLI unless the repository already contains a Docker client abstraction.

Do not add a large Docker SDK dependency solely for this feature.

---

# Streaming Output

Preserve the factory's existing Pi output/event behavior.

Conceptually:

```text
docker exec stdout
       |
       v
existing run event/log pipeline
       |
       v
Vite UI
```

Likewise for stderr.

The sandbox abstraction must not buffer the entire process output before returning.

---

# Cancellation

Existing run cancellation must terminate execution inside Docker.

Cancellation sequence:

```text
AbortSignal fires
      |
terminate docker exec process
      |
stop container
      |
destroy container
      |
mark run cancelled through existing logic
```

Container termination should have a bounded graceful period and then force removal if necessary.

Do not allow cancellation to leave a persistent container.

---

# Cleanup

Always clean up:

```text
Docker container
run-local copied auth.json
sandbox runtime directory
```

Do not alter existing worktree cleanup semantics except to ensure Docker has released the bind mount before the worktree is removed.

Recommended order:

```text
1. terminate Pi
2. stop container
3. remove container
4. remove sandbox runtime directory
5. existing worktree finalization/cleanup
```

Use `finally`.

Cleanup should be idempotent.

---

# Crash Recovery

On application startup, detect orphaned factory containers.

All factory containers must carry labels:

```text
software-factory.sandbox=true
software-factory.run-id=<run-id>
```

Example:

```bash
--label software-factory.sandbox=true
--label software-factory.run-id=<run-id>
```

Startup recovery should enumerate containers with:

```text
software-factory.sandbox=true
```

and remove containers whose associated runs are no longer actively running.

Do not enumerate/delete unrelated Docker containers.

---

# Naming

Container names should be deterministic but sanitized:

```text
factory-<run-id>
```

Do not depend on the container name as the primary identity.

Persist/use the Docker container ID internally.

---

# Configuration

Add a sandbox configuration section consistent with the factory's existing configuration system.

Conceptually:

```ts
interface DockerSandboxConfig {
  enabled: boolean;
  image: string;

  limits: {
    cpus: number;
    memory: string;
    pids: number;
  };

  network: "default" | "none";

  piAuthPath?: string;
}
```

Do not introduce environment variables if the application already has a typed/config-file based configuration mechanism.

Follow existing conventions.

---

# Provider Selection

Even if Docker is initially the only sandbox implementation, keep provider selection explicit.

Example:

```ts
type SandboxType =
  | "docker"
  | "none";
```

`none` may represent the existing host execution path during migration/testing.

Higher-level agent code should receive a `SandboxProvider`, not branch repeatedly on:

```ts
if (dockerEnabled)
```

---

# Integration With Existing Git Worktrees

Do not create another source-code copy.

The existing run worktree is the workspace.

Host:

```text
<existing-run-worktree>
```

Container:

```text
/workspace
```

All modifications made by the agent therefore appear immediately in the existing worktree.

Existing commit/diff/merge logic should continue working without modification wherever possible.

The container must be stopped before any code that removes the worktree.

---

# Integration With pidev / Pi

Keep the existing Pi invocation and behavioral configuration intact.

The primary change should be execution location:

Before:

```text
Node
  ->
spawn pidev on host
```

After:

```text
Node
  ->
DockerSandbox.exec(...)
  ->
pidev inside container
```

Do not rewrite the Pi orchestration layer unless required.

Any path passed to Pi that currently refers to the host worktree must become:

```text
/workspace
```

inside the sandbox.

Pi state should use:

```text
HOME=/home/agent
```

with the copied auth file available at:

```text
/home/agent/.pi/agent/auth.json
```

Verify the actual Pi paths used by the project's installed version rather than assuming path conventions if the codebase already provides them.

---

# Error Handling

Expose useful errors for at least:

```text
Docker unavailable
Docker image missing
container creation failed
worktree mount failed
Pi auth.json missing
Pi authentication rejected
Pi command failed
resource limit termination
container unexpectedly exited
run cancelled
cleanup failure
```

Distinguish infrastructure errors from normal agent failures where the existing run model permits it.

Never include the contents of `auth.json` in logs or error messages.

---

# Logging

Log:

```text
run ID
sandbox provider
container ID
container lifecycle transitions
executed program name
exit code
duration
cleanup result
```

Do not log:

```text
auth.json contents
OAuth tokens
full environment variables
credential-bearing command arguments
```

---

# Tests

## Unit tests

Cover:

### Docker command construction

Given:

```ts
workspacePath
runPiDir
limits
network
runId
```

verify expected:

```text
mounts
labels
security flags
resource limits
working directory
user
environment
```

### Auth preparation

Verify:

```text
auth.json copied
parent directory created
source file untouched
run receives independent copy
```

### Cleanup

Verify repeated cleanup calls do not fail.

### Command execution

Verify:

```text
stdout forwarded
stderr forwarded
exit code returned
AbortSignal respected
```

---

# Integration Test

Add an integration test that requires Docker and can be skipped when Docker is unavailable.

Flow:

```text
create temporary Git repository
create worktree
create temporary fake Pi auth directory
create sandbox
execute shell command inside sandbox
write /workspace/sandbox-test.txt
destroy sandbox
assert file exists in host worktree
assert unrelated host temp file cannot be accessed through expected paths
assert container no longer exists
```

A separate Pi/Copilot integration test may be manual because it requires real user authentication.

---

# Manual Acceptance Test

With an existing valid GitHub Copilot Pi login:

1. Start a normal factory run with Docker sandboxing enabled.
2. Confirm a per-run Docker container appears.
3. Confirm the existing Git worktree is mounted at `/workspace`.
4. Confirm `/home/agent/.pi/agent/auth.json` exists in the container.
5. Confirm Pi can invoke GitHub Copilot without asking for an API key.
6. Ask the agent to create or modify a file.
7. Confirm the modification appears in the host Git worktree.
8. Confirm normal factory diff/commit/merge handling still works.
9. Finish the run.
10. Confirm the container is gone.
11. Confirm the run-local sandbox credential directory is gone.
12. Confirm the canonical host Pi `auth.json` is untouched.

---

# Security Acceptance Test

From within an agent sandbox, confirm:

```bash
id
pwd
cat /etc/passwd
```

work normally.

Confirm:

```bash
ls /workspace
```

shows only the current worktree.

Confirm no mount exposes:

```text
host home directory
factory data root
other runs
other worktrees
Docker socket
SSH credentials
```

Confirm:

```bash
test ! -S /var/run/docker.sock
```

passes.

Inspect:

```bash
docker inspect <container>
```

and verify:

```text
CapDrop includes ALL
NoNewPrivileges enabled
memory limit configured
CPU limit configured
PID limit configured
only expected bind mounts present
```

---

# Non-Goals

Do not implement:

* Firecracker
* Kubernetes
* remote execution
* E2B
* gVisor
* Docker socket access from the agent
* credential proxying
* Copilot token brokering
* network domain allowlists
* nested Docker
* Docker-in-Docker
* automatic synchronization of refreshed Pi credentials
* replacement of the existing Git worktree implementation
* a generic container orchestration platform

---

# Suggested Implementation Structure

Adapt names to the repository conventions.

```text
src/
  sandbox/
    Sandbox.ts
    SandboxProvider.ts

    docker/
      DockerSandbox.ts
      DockerSandboxProvider.ts
      dockerProcess.ts
      preparePiAuth.ts
      cleanupOrphans.ts
```

Possible responsibilities:

```text
Sandbox.ts
    provider-neutral contract

DockerSandboxProvider.ts
    prepare runtime state
    create container
    return DockerSandbox

DockerSandbox.ts
    exec
    stop
    destroy

dockerProcess.ts
    safe spawn wrapper around docker CLI

preparePiAuth.ts
    copy canonical auth.json into run-local state

cleanupOrphans.ts
    remove stale labeled factory containers
```

---

# Implementation Principle

The important invariant is:

```text
Agent-controlled execution
        |
        v
Docker container
```

There should be no fallback path where arbitrary Pi-generated shell commands execute directly through the Node host process when Docker sandboxing is enabled.

The only host-side operations required for a normal run should be orchestration operations such as:

```text
Git worktree management
copying auth.json
Docker lifecycle operations
reading run metadata
existing post-run Git processing
```

Everything initiated by the agent as shell/filesystem workload should execute against `/workspace` from inside the container.

---

# Definition of Done

This feature is complete when:

* existing Git worktrees are used directly as Docker workspaces
* every sandboxed run gets a disposable Docker container
* Pi/pidev executes inside that container
* GitHub Copilot authentication works by copying `auth.json` into run-local mounted state
* agent changes appear directly in the corresponding Git worktree
* stdout/stderr continue flowing through the existing UI/logging system
* run cancellation destroys the container
* normal completion destroys the container
* failed runs destroy the container
* stale containers are cleaned on startup
* only the current worktree and run-local Pi state are host-mounted
* Docker socket and broader factory storage are never mounted
* resource/security defaults are applied
* the canonical host Pi credentials are never modified by a sandbox run
* existing non-sandbox behavior remains available if the current architecture requires it
