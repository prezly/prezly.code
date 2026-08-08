# Prezly.code

Prezly.code is Prezly's managed, desktop-only T3 Code product profile. It keeps T3's provider,
thread, and orchestration internals while replacing local environment management with Jude.

## Product model

- A Jude session is one P3 environment and contains one T3 project rooted at `/source`.
- A project can contain any number of threads. Jude's session prompt is not the P3 thread model
  and does not limit users to one prompt.
- Jude is the authority for the environment list. Ready sessions appear automatically; sessions
  removed from Jude disappear from P3 after the next refresh.
- P3 does not create local environments, projects, directories, or T3 worktrees. The Jude session
  itself provides the isolated checkout.
- P3 currently relies on network access through Warp. There is no Jude user authentication or
  user-scoped discovery yet.

## Connection flow

The Electron main process proxies the Jude control-plane API at `/_p3/jude` so the renderer does
not depend on Jude CORS configuration. The renderer polls `GET /api/sessions`, requests a fresh T3
pairing credential for ready sessions, and registers those T3 servers as platform-managed
environments. Pairing authenticates the transport to each T3 server; it is not Jude user auth.

Jude's T3 containers already start in `/source` with
`--auto-bootstrap-project-from-cwd`. That deployment invariant creates the single project while
T3 continues to own its multiple durable threads.

## Desktop build

Build P3 with the existing desktop artifact pipeline and the P3 product profile:

```sh
pnpm dist:desktop:artifact -- --product-profile p3
```

Platform-specific targets accept the same option, for example:

```sh
pnpm dist:desktop:dmg:arm64 -- --product-profile p3
```

The profile produces the Prezly.code application name, `com.prezly.p3code` application identifier,
`p3code` protocol scheme, separate application data, and a renderer-only desktop process without
a local T3 backend.

## Future auth boundary

User authentication and user-scoped environment discovery belong at the Electron Jude proxy.
That boundary can add Jude credentials without changing the environment reconciliation or the
T3 connection registry.
