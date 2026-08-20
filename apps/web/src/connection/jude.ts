import { ConnectionTransientError } from "@t3tools/client-runtime/connection";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const JudeSessionStatus = Schema.Literals([
  "provisioning",
  "ready",
  "degraded",
  "failed",
  "deleting",
  "unknown",
]);

const JudeCreatorSchema = Schema.Struct({
  kind: Schema.optional(Schema.Literals(["github-user", "service-account"])),
  subject: Schema.optional(Schema.String),
  id: Schema.Number,
  login: Schema.String,
  name: Schema.String,
  email: Schema.optional(Schema.String),
  avatarUrl: Schema.optional(Schema.String),
});

const JudeSessionSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  visitUrl: Schema.optional(Schema.String),
  prompt: Schema.String,
  project: Schema.String,
  // Jude has used both names while rolling out branch metadata.
  baseRef: Schema.optional(Schema.String),
  branch: Schema.optional(Schema.String),
  createdBy: Schema.optional(JudeCreatorSchema),
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

const JudeT3EnvironmentState = Schema.Literals(["ready", "starting", "unavailable"]);

const JudeT3EnvironmentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  visitUrl: Schema.optional(Schema.String),
  prompt: Schema.String,
  project: Schema.String,
  baseRef: Schema.optional(Schema.String),
  branch: Schema.optional(Schema.String),
  createdBy: Schema.optional(JudeCreatorSchema),
  status: JudeSessionStatus,
  urls: Schema.Struct({ t3: Schema.String }),
  t3: Schema.Struct({
    state: JudeT3EnvironmentState,
    retryAfterMs: Schema.optional(Schema.Number),
    reason: Schema.optional(Schema.Literals(["service-not-ready", "pairing-unavailable"])),
  }),
});

const JudeT3EnvironmentsResponseSchema = Schema.Struct({
  revision: Schema.String,
  retryAfterMs: Schema.optional(Schema.Number),
  environments: Schema.Array(JudeT3EnvironmentSchema),
});

const JudeModelSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
});

const JudeModelsResponseSchema = Schema.Struct({
  models: Schema.Array(JudeModelSchema),
});

const decodeJudeSessionsResponse = Schema.decodeUnknownEffect(JudeSessionsResponseSchema);
const decodeJudeCurrentUser = Schema.decodeUnknownEffect(JudeCreatorSchema);
const decodeJudeT3Pairing = Schema.decodeUnknownEffect(JudeT3PairingSchema);
const decodeJudeT3EnvironmentsResponse = Schema.decodeUnknownEffect(
  JudeT3EnvironmentsResponseSchema,
);
const decodeJudeSession = Schema.decodeUnknownEffect(JudeSessionSchema);
const decodeJudeModelsResponse = Schema.decodeUnknownEffect(JudeModelsResponseSchema);
const encodeUnknownJson = Schema.encodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

let judeAuthenticationPromise: Promise<void> | null = null;

export type JudeSession = typeof JudeSessionSchema.Type;
export type JudeCurrentUser = typeof JudeCreatorSchema.Type;
export type JudeSessionDiscoveryState = "pending" | "ready" | "error";

export function isJudeSessionOperational(session: JudeSession): boolean {
  return session.status === "ready" || session.status === "degraded";
}
export type JudeT3Pairing = typeof JudeT3PairingSchema.Type;
export type JudeT3Environment = typeof JudeT3EnvironmentSchema.Type;
export type JudeT3EnvironmentsSnapshot =
  | {
      readonly _tag: "NotModified";
    }
  | {
      readonly _tag: "RouteUnavailable";
    }
  | {
      readonly _tag: "Updated";
      readonly revision: string;
      readonly etag: string | null;
      readonly retryAfterMs: number | undefined;
      readonly environments: ReadonlyArray<JudeT3Environment>;
    };

export type JudeModel = typeof JudeModelSchema.Type;

export interface CreateJudeSessionInput {
  readonly prompt: string;
  readonly project: string;
  readonly model: string;
  readonly baseRef: string;
  readonly customLicenses?: ReadonlyArray<string>;
}

let judeSessionsSnapshot: ReadonlyArray<JudeSession> = [];
let judeSessionsSignature = "[]";
const judeSessionsListeners = new Set<() => void>();
let judeSessionDiscoveryStateSnapshot: JudeSessionDiscoveryState = "pending";
const judeSessionDiscoveryStateListeners = new Set<() => void>();
let judeCurrentUserSnapshot: JudeCurrentUser | null = null;
const judeCurrentUserListeners = new Set<() => void>();
let createdJudeSessionIdsSnapshot: ReadonlyArray<string> = [];
const createdJudeSessionIdsListeners = new Set<() => void>();
const judeEnvironmentRefreshListeners = new Set<() => void>();

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

export function judeSessionDisplayName(session: JudeSession): string {
  return session.prompt.trim() || session.name.trim() || formatJudeAppName(session.project);
}

export function judeSessionProjectPickerName(session: JudeSession): string {
  return `${formatJudeAppName(session.project)} · ${judeSessionDisplayName(session)}`;
}

export function judeSessionBranchName(session: JudeSession): string | null {
  return session.branch?.trim() || session.baseRef?.trim() || null;
}

export function judeSessionOwnerLabel(session: JudeSession): string | null {
  const creator = session.createdBy;
  if (!creator) return null;
  if (creator.kind === "service-account") {
    return creator.name.trim() || creator.login || creator.subject || null;
  }
  return creator.login ? `@${creator.login}` : creator.name.trim() || null;
}

export function isJudeSessionOwnedByCurrentUser(
  session: JudeSession,
  user: JudeCurrentUser | null,
): boolean {
  return user !== null && user.id !== 0 && session.createdBy?.id === user.id;
}

export function judeSessionIdFromConnectionId(connectionId: string | null): string | null {
  return connectionId?.startsWith("jude:") ? connectionId.slice("jude:".length) : null;
}

export function judeSessionForConnection(
  connectionId: string | null,
  sessions: ReadonlyArray<JudeSession>,
): JudeSession | null {
  const sessionId = judeSessionIdFromConnectionId(connectionId);
  const session = sessionId ? sessions.find((candidate) => candidate.id === sessionId) : undefined;
  return session ?? null;
}

export function judeSessionNameForConnection(
  connectionId: string | null,
  sessions: ReadonlyArray<JudeSession>,
): string | null {
  const session = judeSessionForConnection(connectionId, sessions);
  return session ? judeSessionDisplayName(session) : null;
}

export function getJudeSessionsSnapshot(): ReadonlyArray<JudeSession> {
  return judeSessionsSnapshot;
}

export function subscribeToJudeSessions(listener: () => void): () => void {
  judeSessionsListeners.add(listener);
  return () => judeSessionsListeners.delete(listener);
}

export function getJudeSessionDiscoveryStateSnapshot(): JudeSessionDiscoveryState {
  return judeSessionDiscoveryStateSnapshot;
}

export function subscribeToJudeSessionDiscoveryState(listener: () => void): () => void {
  judeSessionDiscoveryStateListeners.add(listener);
  return () => judeSessionDiscoveryStateListeners.delete(listener);
}

export function getJudeCurrentUserSnapshot(): JudeCurrentUser | null {
  return judeCurrentUserSnapshot;
}

export function subscribeToJudeCurrentUser(listener: () => void): () => void {
  judeCurrentUserListeners.add(listener);
  return () => judeCurrentUserListeners.delete(listener);
}

export function getCreatedJudeSessionIdsSnapshot(): ReadonlyArray<string> {
  return createdJudeSessionIdsSnapshot;
}

export function subscribeToCreatedJudeSessionIds(listener: () => void): () => void {
  createdJudeSessionIdsListeners.add(listener);
  return () => createdJudeSessionIdsListeners.delete(listener);
}

export function dismissCreatedJudeSession(sessionId: string): void {
  const next = createdJudeSessionIdsSnapshot.filter((candidate) => candidate !== sessionId);
  if (next.length === createdJudeSessionIdsSnapshot.length) return;
  createdJudeSessionIdsSnapshot = next;
  for (const listener of createdJudeSessionIdsListeners) listener();
}

export function requestJudeEnvironmentRefresh(): void {
  for (const listener of judeEnvironmentRefreshListeners) listener();
}

export function subscribeToJudeEnvironmentRefresh(listener: () => void): () => void {
  judeEnvironmentRefreshListeners.add(listener);
  return () => judeEnvironmentRefreshListeners.delete(listener);
}

function publishJudeSessions(sessions: ReadonlyArray<JudeSession>): void {
  const signature = JSON.stringify(sessions);
  if (signature === judeSessionsSignature) return;
  judeSessionsSignature = signature;
  judeSessionsSnapshot = sessions;
  for (const listener of judeSessionsListeners) listener();
}

function publishJudeSessionDiscoveryState(state: JudeSessionDiscoveryState): void {
  if (state === judeSessionDiscoveryStateSnapshot) return;
  judeSessionDiscoveryStateSnapshot = state;
  for (const listener of judeSessionDiscoveryStateListeners) listener();
}

function publishJudeCurrentUser(user: JudeCurrentUser): void {
  if (JSON.stringify(user) === JSON.stringify(judeCurrentUserSnapshot)) return;
  judeCurrentUserSnapshot = user;
  for (const listener of judeCurrentUserListeners) listener();
}

function publishCreatedJudeSession(session: JudeSession): void {
  createdJudeSessionIdsSnapshot = [
    session.id,
    ...createdJudeSessionIdsSnapshot.filter((candidate) => candidate !== session.id),
  ];
  for (const listener of createdJudeSessionIdsListeners) listener();
  publishJudeSessions([
    session,
    ...judeSessionsSnapshot.filter((candidate) => candidate.id !== session.id),
  ]);
}

export function judeSessionDetailUrl(judeBaseUrl: string, sessionId: string): string {
  return new URL(`/session/${encodeURIComponent(sessionId)}`, judeBaseUrl).toString();
}

export function judeSessionDetailUrlForConnection(
  judeBaseUrl: string,
  connectionId: string | null,
): string | null {
  const sessionId = judeSessionIdFromConnectionId(connectionId);
  return sessionId ? judeSessionDetailUrl(judeBaseUrl, sessionId) : null;
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
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}) {
  const fetchRequest = () =>
    input.fetch.call(globalThis, `${JUDE_DESKTOP_PROXY_PATH}${input.path}`, {
      method: input.method,
      ...(input.body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: encodeUnknownJson(input.body),
          }),
      ...(input.signal ? { signal: input.signal } : {}),
    });
  let response = yield* Effect.tryPromise({
    try: fetchRequest,
    catch: (cause) => discoveryError(input.operation, cause),
  });
  if (response.status === 401 && window.desktopBridge?.authenticateJude) {
    judeAuthenticationPromise ??= window.desktopBridge.authenticateJude().finally(() => {
      judeAuthenticationPromise = null;
    });
    yield* Effect.tryPromise({
      try: () => judeAuthenticationPromise!,
      catch: (cause) => discoveryError(`${input.operation} authentication`, cause),
    });
    response = yield* Effect.tryPromise({
      try: fetchRequest,
      catch: (cause) => discoveryError(input.operation, cause),
    });
  }
  if (!response.ok) {
    return yield* discoveryError(input.operation, `HTTP ${response.status}`);
  }
  return yield* Effect.tryPromise({
    try: async (): Promise<unknown> => response.json(),
    catch: (cause) => discoveryError(input.operation, cause),
  });
});

export const ensureJudeAuthenticated = Effect.fn("web.jude.ensureAuthenticated")(function* (
  fetch: typeof globalThis.fetch = globalThis.fetch,
  signal?: AbortSignal,
) {
  const body = yield* requestJson({
    fetch,
    operation: "authentication check",
    path: "/api/auth/me",
    method: "GET",
    ...(signal ? { signal } : {}),
  });
  const user = yield* decodeJudeCurrentUser(body).pipe(
    Effect.mapError((cause) => discoveryError("authentication check", cause)),
  );
  publishJudeCurrentUser(user);
  requestJudeEnvironmentRefresh();
});

export const listJudeSessions = Effect.fn("web.jude.listSessions")(function* (
  fetch: typeof globalThis.fetch = globalThis.fetch,
) {
  return yield* Effect.gen(function* () {
    const body = yield* requestJson({
      fetch,
      operation: "session discovery",
      path: "/api/sessions",
      method: "GET",
    });
    const response = yield* decodeJudeSessionsResponse(body).pipe(
      Effect.mapError((cause) => discoveryError("session discovery", cause)),
    );
    publishJudeSessions(response.sessions);
    publishJudeSessionDiscoveryState("ready");
    return response.sessions;
  }).pipe(
    Effect.tapError(() =>
      Effect.sync(() => {
        // A refresh failure must not hide controls backed by the last known-good session list.
        if (judeSessionDiscoveryStateSnapshot !== "ready") {
          publishJudeSessionDiscoveryState("error");
        }
      }),
    ),
  );
});

export const listJudeT3Environments = Effect.fn("web.jude.listT3Environments")(function* (
  etag: string | null,
  fetch: typeof globalThis.fetch = globalThis.fetch,
) {
  const fetchSnapshot = () =>
    fetch.call(globalThis, `${JUDE_DESKTOP_PROXY_PATH}/api/t3/environments`, {
      method: "GET",
      ...(etag ? { headers: { "If-None-Match": etag } } : {}),
    });
  let response = yield* Effect.tryPromise({
    try: fetchSnapshot,
    catch: (cause) => discoveryError("T3 environment discovery", cause),
  });
  if (response.status === 401 && window.desktopBridge?.authenticateJude) {
    judeAuthenticationPromise ??= window.desktopBridge.authenticateJude().finally(() => {
      judeAuthenticationPromise = null;
    });
    yield* Effect.tryPromise({
      try: () => judeAuthenticationPromise!,
      catch: (cause) => discoveryError("T3 environment discovery authentication", cause),
    });
    response = yield* Effect.tryPromise({
      try: fetchSnapshot,
      catch: (cause) => discoveryError("T3 environment discovery", cause),
    });
  }
  if (response.status === 304) return { _tag: "NotModified" } as const;
  if (response.status === 404) return { _tag: "RouteUnavailable" } as const;
  if (!response.ok) {
    return yield* discoveryError("T3 environment discovery", `HTTP ${response.status}`);
  }
  const body = yield* Effect.tryPromise({
    try: async (): Promise<unknown> => response.json(),
    catch: (cause) => discoveryError("T3 environment discovery", cause),
  });
  const rawSnapshot = yield* decodeJudeT3EnvironmentsResponse(body).pipe(
    Effect.mapError((cause) => discoveryError("T3 environment discovery", cause)),
  );
  publishJudeSessions(rawSnapshot.environments);
  publishJudeSessionDiscoveryState("ready");
  return {
    _tag: "Updated",
    revision: rawSnapshot.revision,
    etag: response.headers.get("ETag"),
    retryAfterMs: rawSnapshot.retryAfterMs,
    environments: rawSnapshot.environments,
  } as const;
});

export function refreshJudeEnvironments(): Promise<ReadonlyArray<JudeSession>> {
  requestJudeEnvironmentRefresh();
  return Effect.runPromise(listJudeSessions());
}

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
  return yield* decodeJudeT3Pairing(body).pipe(
    Effect.mapError((cause) => discoveryError(`T3 pairing for ${sessionId}`, cause)),
  );
});

export const listJudeModels = Effect.fn("web.jude.listModels")(function* (
  fetch: typeof globalThis.fetch = globalThis.fetch,
) {
  const body = yield* requestJson({
    fetch,
    operation: "model discovery",
    path: "/api/models",
    method: "GET",
  });
  const response = yield* decodeJudeModelsResponse(body).pipe(
    Effect.mapError((cause) => discoveryError("model discovery", cause)),
  );
  return response.models;
});

export const createJudeSession = Effect.fn("web.jude.createSession")(function* (
  input: CreateJudeSessionInput,
  fetch: typeof globalThis.fetch = globalThis.fetch,
) {
  const body = yield* requestJson({
    fetch,
    operation: "session creation",
    path: "/api/sessions",
    method: "POST",
    body: input,
  });
  const session = yield* decodeJudeSession(body).pipe(
    Effect.mapError((cause) => discoveryError("session creation", cause)),
  );
  publishCreatedJudeSession(session);
  return session;
});

function waitForDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      globalThis.clearTimeout(timeout);
      reject(signal?.reason);
    };
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function provisionJudeProject(
  input: CreateJudeSessionInput,
  options: {
    readonly fetch?: typeof globalThis.fetch;
    readonly signal?: AbortSignal;
    readonly pollIntervalMs?: number;
    readonly timeoutMs?: number;
    readonly onCreated?: (session: JudeSession) => void;
  } = {},
): Promise<JudeSession> {
  const fetch = options.fetch ?? globalThis.fetch;
  const created = await Effect.runPromise(createJudeSession(input, fetch));
  options.onCreated?.(created);
  const deadline = Date.now() + (options.timeoutMs ?? 15 * 60_000);

  while (Date.now() < deadline) {
    if (isJudeSessionOperational(created)) {
      requestJudeEnvironmentRefresh();
      return created;
    }
    if (created.status === "failed" || created.status === "deleting") {
      throw new Error(`Jude could not provision ${created.name}.`);
    }

    await waitForDelay(options.pollIntervalMs ?? 3_000, options.signal);
    const sessions = await Effect.runPromise(listJudeSessions(fetch));
    const session = sessions.find((candidate) => candidate.id === created.id);
    if (!session) {
      continue;
    }
    if (isJudeSessionOperational(session)) {
      requestJudeEnvironmentRefresh();
      return session;
    }
    if (session.status === "failed" || session.status === "deleting") {
      throw new Error(`Jude could not provision ${session.name}.`);
    }
  }

  throw new Error(`Jude is still provisioning ${created.name}. Try refreshing environments later.`);
}
