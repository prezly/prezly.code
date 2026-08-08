import { ConnectionTransientError } from "@t3tools/client-runtime/connection";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const JudeSessionStatus = Schema.Literals([
  "provisioning",
  "ready",
  "failed",
  "deleting",
  "unknown",
]);

const JudeSessionSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  prompt: Schema.String,
  project: Schema.String,
  status: JudeSessionStatus,
  urls: Schema.Struct({
    t3: Schema.String,
  }),
});

const JudeSessionsResponseSchema = Schema.Struct({
  sessions: Schema.Array(JudeSessionSchema),
});

const JudeT3PairingSchema = Schema.Struct({
  pairingUrl: Schema.String,
  expiresAt: Schema.String,
  serverVersion: Schema.String,
});

export type JudeSession = typeof JudeSessionSchema.Type;
export type JudeT3Pairing = typeof JudeT3PairingSchema.Type;

export const JUDE_DESKTOP_PROXY_PATH = "/_p3/jude";

const JUDE_APP_NAMES: Readonly<Record<string, string>> = {
  app: "App",
  website: "Website",
  "admin-v2": "Admin v2",
  jude: "Jude",
  jenny: "Jenny",
};

export function formatJudeAppName(project: string): string {
  return JUDE_APP_NAMES[project] ?? project;
}

export function judeSessionDetailUrl(judeBaseUrl: string, sessionId: string): string {
  return new URL(`/session/${encodeURIComponent(sessionId)}`, judeBaseUrl).toString();
}

function discoveryError(operation: string, cause: unknown) {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new ConnectionTransientError({
    reason: "remote-unavailable",
    detail: `Jude ${operation} failed: ${detail}`,
  });
}

const requestJson = Effect.fn("web.jude.requestJson")(function* (input: {
  readonly fetch: typeof globalThis.fetch;
  readonly operation: string;
  readonly path: string;
  readonly method: "GET" | "POST";
}) {
  const response = yield* Effect.tryPromise({
    try: () =>
      input.fetch.call(globalThis, `${JUDE_DESKTOP_PROXY_PATH}${input.path}`, {
        method: input.method,
      }),
    catch: (cause) => discoveryError(input.operation, cause),
  });
  if (!response.ok) {
    return yield* discoveryError(input.operation, `HTTP ${response.status}`);
  }
  return yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => discoveryError(input.operation, cause),
  });
});

export const listJudeSessions = Effect.fn("web.jude.listSessions")(function* (
  fetch: typeof globalThis.fetch = globalThis.fetch,
) {
  const body = yield* requestJson({
    fetch,
    operation: "session discovery",
    path: "/api/sessions",
    method: "GET",
  });
  const response = yield* Schema.decodeUnknownEffect(JudeSessionsResponseSchema)(body).pipe(
    Effect.mapError((cause) => discoveryError("session discovery", cause)),
  );
  return response.sessions;
});

export const issueJudeT3Pairing = Effect.fn("web.jude.issueT3Pairing")(function* (
  sessionId: string,
  fetch: typeof globalThis.fetch = globalThis.fetch,
) {
  const body = yield* requestJson({
    fetch,
    operation: `T3 pairing for ${sessionId}`,
    path: `/api/sessions/${encodeURIComponent(sessionId)}/t3-pairing`,
    method: "POST",
  });
  return yield* Schema.decodeUnknownEffect(JudeT3PairingSchema)(body).pipe(
    Effect.mapError((cause) => discoveryError(`T3 pairing for ${sessionId}`, cause)),
  );
});
