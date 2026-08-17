# Prezly.code

Prezly.code is Prezly's managed, desktop-only T3 Code product profile. It keeps T3's provider,
thread, and orchestration internals while replacing local environment management with Jude.

## Product model

- A Jude session is one P3 environment and contains one T3 project rooted at `/source`.
- A project can contain any number of threads. Jude's session prompt is not the P3 thread model
  and does not limit users to one prompt.
- Jude is the authority for the environment list. Sessions created by the running client appear as
  temporary non-interactive sidebar rows, become interactive when their T3 project connects, and
  are dismissed after a thread records its first user prompt. Previously discovered
  sessions stay in the project picker instead of being duplicated as top-level sidebar rows.
- P3 does not create local environments, directories, or T3 worktrees. Its **Create project** flow
  provisions a Jude session, publishes it to the client snapshot, waits for it to become ready, and
  then refreshes the managed project list. The Jude session itself provides the isolated checkout.
- P3 uses the Jude session prompt as the user-facing environment name in the sidebar and thread
  breadcrumbs. The project picker prefixes that name with the Jude app, groups the current user's
  sessions separately, and presents Jude's `createdBy` identity instead of the invariant `/source`
  path. When Jude exposes a `visitUrl`, P3 offers it as an attached **Preview** browser surface in
  the right panel; the panel also links to the environment's Jude session details.
- P3 relies on network access through Warp and authenticates to Jude with Jude's GitHub OAuth
  session. Discovery follows Jude's authenticated, user-visible session list.
- P3 keeps the shared pull-request review and T3 Connect implementations in the build, but its
  product capabilities hide their routes and entry points. Jude remains the only managed
  connection path. This lets upstream features stay mergeable without exposing unsupported
  product surfaces in Prezly.code.

## Connection flow

The Electron main process proxies the Jude control-plane API at `/_p3/jude` so the renderer does
not depend on Jude CORS configuration. The proxy uses Electron's Jude cookie session and rewrites
the request origin for Jude's same-origin mutation guard. When Jude returns 401, the renderer asks
the main process to open Jude's GitHub OAuth flow in a desktop-owned window, then retries the
request. The renderer polls `GET /api/sessions`, requests a fresh T3 pairing credential for ready
sessions, and registers those T3 servers as platform-managed environments. Pairing authenticates
the transport to each T3 server; it is separate from Jude user authentication.

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

Prezly.code keeps all durable state separate from T3 Code. Server and client settings, logs,
secrets, and cached environment data live below `~/.p3` (or an explicit `P3CODE_HOME`). Electron
preferences, cookies, IndexedDB, and browser caches use the `p3code` application-data directory and
the `p3code://` origin. An ambient `T3CODE_HOME` never redirects the P3 profile into T3 Code's state
directory.
