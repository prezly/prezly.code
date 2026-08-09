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

Unsigned desktop installers for macOS, Windows, and Linux are published on the
[Prezly.code Releases page](https://github.com/prezly/prezly.code/releases).
Each version has its release notes and all platform installers in one place.

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

## Making a release

Prezly.code uses semantic versions and `v` tags, following T3 Code's release
shape. The first Prezly-specific version is `v0.1.0` because the fork already
contains upstream's earlier `v0.0.x` tags.

Create and push a version tag from the commit to release:

```bash
git tag -a v0.1.0 -m "Prezly.code v0.1.0"
git push origin v0.1.0
```

The **Build Prezly.code desktop installers** workflow then builds macOS arm64,
macOS Intel, Linux x64, and Windows x64. After every build succeeds, it creates
the GitHub Release, generates release notes from the commits since the previous
version, and attaches the installers and update metadata. A normal push to
`main` only produces temporary workflow artifacts; it does not create a release.

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

## Documentation

Full docs live in [docs/](./docs). There's no docs site yet.

- [Install and first run](./docs/user/install.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Customize a project icon](./docs/user/project-settings.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- Linux: [run T3 Code as a background service](./docs/user/background-service.md)

Building from source? Start at [docs/internals/overview.md](./docs/internals/overview.md).

## If you REALLY want to contribute still.... read this first

### Install `vp`

T3 Code uses Vite+ so you'll need to install the global `vp` command-line tool.

#### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

#### Windows

```bash
irm https://vite.plus/ps1 | iex
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Install dependencies

```bash
vp i
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
