import { ConnectionTransientError } from "@t3tools/client-runtime/connection";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  formatJudeAppName,
  issueJudeT3Pairing,
  judeAppNameForConnection,
  judeSessionDetailUrl,
  judeSessionIdFromConnectionId,
  listJudeSessions,
  requestJudeEnvironmentRefresh,
  subscribeToJudeEnvironmentRefresh,
} from "./jude.ts";

describe("Jude discovery", () => {
  it("formats Jude app names and detail links", () => {
    expect(formatJudeAppName("admin-v2")).toBe("Admin v2");
    expect(formatJudeAppName("custom-app")).toBe("custom-app");
    expect(judeSessionDetailUrl("https://jude.prezly.net", "admin/fix")).toBe(
      "https://jude.prezly.net/session/admin%2Ffix",
    );
  });

  it("resolves the Jude app for an environment connection", () => {
    const sessions = [
      {
        id: "admin-fix-search",
        name: "Fix search",
        prompt: "Fix search",
        project: "admin-v2",
        status: "ready" as const,
        urls: { t3: "https://admin-fix-search.t3.jude.prezly.dev" },
      },
    ];

    expect(judeSessionIdFromConnectionId("jude:admin-fix-search")).toBe("admin-fix-search");
    expect(judeAppNameForConnection("jude:admin-fix-search", sessions)).toBe("Admin v2");
    expect(judeAppNameForConnection("remote:admin-fix-search", sessions)).toBeNull();
  });

  it("notifies the platform when a manual refresh is requested", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToJudeEnvironmentRefresh(listener);

    requestJudeEnvironmentRefresh();
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    requestJudeEnvironmentRefresh();
    expect(listener).toHaveBeenCalledOnce();
  });

  it("reads the authoritative session list", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          sessions: [
            {
              id: "admin-fix-search",
              name: "Fix search",
              prompt: "Fix search",
              project: "admin-v2",
              status: "ready",
              urls: { t3: "https://admin-fix-search.t3.jude.prezly.dev" },
              ignored: "field",
            },
          ],
        }),
      ),
    );

    await expect(Effect.runPromise(listJudeSessions(fetch))).resolves.toEqual([
      {
        id: "admin-fix-search",
        name: "Fix search",
        prompt: "Fix search",
        project: "admin-v2",
        status: "ready",
        urls: { t3: "https://admin-fix-search.t3.jude.prezly.dev" },
      },
    ]);
    expect(fetch).toHaveBeenCalledWith("/_p3/jude/api/sessions", { method: "GET" });
  });

  it("invokes browser fetch with the global receiver", async () => {
    let receiver: unknown;
    const fetch = vi.fn(function (this: unknown) {
      receiver = this;
      return Promise.resolve(new Response(JSON.stringify({ sessions: [] })));
    }) as typeof globalThis.fetch;

    await Effect.runPromise(listJudeSessions(fetch));

    expect(receiver).toBe(globalThis);
  });

  it("requests a fresh pairing URL for an environment", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          pairingUrl: "https://admin-fix-search.t3.jude.prezly.dev/pair#token=fresh",
          expiresAt: "2026-08-08T13:00:00Z",
          serverVersion: "0.0.31",
        }),
      ),
    );

    await expect(Effect.runPromise(issueJudeT3Pairing("admin/fix", fetch))).resolves.toMatchObject({
      pairingUrl: "https://admin-fix-search.t3.jude.prezly.dev/pair#token=fresh",
    });
    expect(fetch).toHaveBeenCalledWith("/_p3/jude/api/sessions/admin%2Ffix/t3-pairing", {
      method: "POST",
    });
  });

  it("surfaces Jude failures as retryable environment failures", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));

    const exit = await Effect.runPromiseExit(listJudeSessions(fetch));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      const error = Cause.squash(exit.cause);
      expect(error).toBeInstanceOf(ConnectionTransientError);
    }
  });
});
