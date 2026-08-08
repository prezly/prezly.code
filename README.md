# Prezly.code

Prezly.code is Prezly's dedicated desktop app for working with coding agents in
[Jude](https://jude.prezly.net). It is a focused downstream fork of
[T3 Code](https://github.com/pingdotgg/t3code): we keep T3's fast, multi-provider
agent interface and replace its local-workspace model with Jude-managed environments.

## The idea

Jude owns the machines, repositories, and worktrees. Prezly.code is the control
surface for the conversations running there.

- Every ready Jude environment appears as a project automatically.
- A Jude environment can contain multiple prompts and threads.
- The workspace is always `/source`; Prezly.code never asks for a directory.
- There is no local-development or local-worktree mode. Jude environments are
  already isolated worktrees.
- Removing an environment from Jude removes it from Prezly.code after the next
  successful sync.
- Discovery runs every three seconds. You can also refresh from the sidebar,
  Connections settings, or a thread's context menu.
- Jude currently relies on Warp network access and does not require separate
  authentication. User-scoped Jude environments can be added later.

If Jude is temporarily unreachable, Prezly.code keeps valid cached connections
and retries. A failed request is never treated as an authoritative deletion.

## For Prezlians

1. Connect to the Prezly network through Warp.
2. Open Prezly.code.
3. Pick a Jude environment from the project switcher.
4. Continue an existing prompt or start another thread in that environment.

Unsigned desktop installers for macOS, Windows, and Linux are built by GitHub
Actions. Open the latest **Build Prezly.code desktop installers** workflow run
and download the artifact for your platform.

## Building locally

Install the repository's Vite+ toolchain and dependencies, then build the P3
product profile:

```bash
vp install
T3CODE_PRODUCT_PROFILE=p3 vp run build:desktop
```

Launch the built desktop app:

```bash
T3CODE_PRODUCT_PROFILE=p3 node apps/desktop/scripts/start-electron.mjs
```

## Keeping up with T3 Code

The remotes in the primary checkout are intentionally split:

- `origin` is `prezly/prezly.code`.
- `upstream` is `pingdotgg/t3code`.

Prezly-specific behavior lives behind the `p3` product profile and is kept in
small, focused commits. To bring in upstream changes:

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

Resolve conflicts by preserving upstream's default `t3` behavior and applying
Prezly differences only when the `p3` profile is active. Do not rename upstream
packages or broadly replace T3 terminology in shared code; that makes future
merges unnecessarily difficult.

## Relationship to upstream

T3 Code remains the foundation and source of general product improvements.
Prezly.code should contain only the Jude integration, Prezly identity, focused
product decisions, and the build/release configuration needed by Prezlians.

The upstream project is open source. Its original license and notices remain in
this repository.
