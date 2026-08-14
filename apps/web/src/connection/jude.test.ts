import { ConnectionTransientError } from "@t3tools/client-runtime/connection";
import { describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { expect, vi } from "vite-plus/test";

import {
  createJudeSession,
  dismissCreatedJudeSession,
  formatJudeAppName,
  getCreatedJudeSessionIdsSnapshot,
  getJudeSessionsSnapshot,
  issueJudeT3Pairing,
  judeSessionDisplayName,
  judeSessionNameForConnection,
  judeSessionProjectPickerName,
  judeSessionDetailUrl,
  judeSessionDetailUrlForConnection,
  judeSessionIdFromConnectionId,
  listJudeSessions,
  provisionJudeProject,
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
    expect(
      judeSessionDetailUrlForConnection("https://jude.prezly.net", "jude:website-t3websie"),
    ).toBe("https://jude.prezly.net/session/website-t3websie");
    expect(
      judeSessionDetailUrlForConnection("https://jude.prezly.net", "remote:website-t3websie"),
    ).toBeNull();
  });

  it("resolves the Jude environment name from its prompt", () => {
    const sessions = [
      {
        id: "admin-fix-search",
        name: "admin-fix-search",
        prompt: "Fix search",
        project: "admin-v2",
        status: "ready" as const,
        urls: { t3: "https://admin-fix-search.t3.jude.prezly.dev" },
      },
    ];

    expect(judeSessionIdFromConnectionId("jude:admin-fix-search")).toBe("admin-fix-search");
    expect(judeSessionDisplayName(sessions[0]!)).toBe("Fix search");
    expect(judeSessionProjectPickerName(sessions[0]!)).toBe("Admin v2 · Fix search");
    expect(judeSessionNameForConnection("jude:admin-fix-search", sessions)).toBe("Fix search");
    expect(judeSessionNameForConnection("remote:admin-fix-search", sessions)).toBeNull();
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

  it.effect("reads the authoritative session list", () =>
    Effect.gen(function* () {
      const createdSessionIdsBeforeDiscovery = getCreatedJudeSessionIdsSnapshot();
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        Response.json({
          sessions: [
            {
              id: "admin-fix-search",
              name: "admin-fix-search",
              visitUrl: "https://admin-fix-search.admin-v2.jude.prezly.dev",
              prompt: "Fix search",
              project: "admin-v2",
              status: "ready",
              urls: { t3: "https://admin-fix-search.t3.jude.prezly.dev" },
              ignored: "field",
            },
          ],
        }),
      );

      expect(yield* listJudeSessions(fetch)).toEqual([
        {
          id: "admin-fix-search",
          name: "admin-fix-search",
          visitUrl: "https://admin-fix-search.admin-v2.jude.prezly.dev",
          prompt: "Fix search",
          project: "admin-v2",
          status: "ready",
          urls: { t3: "https://admin-fix-search.t3.jude.prezly.dev" },
        },
      ]);
      expect(getCreatedJudeSessionIdsSnapshot()).toBe(createdSessionIdsBeforeDiscovery);
      expect(fetch).toHaveBeenCalledWith("/_p3/jude/api/sessions", { method: "GET" });
    }),
  );

  it.effect("invokes browser fetch with the global receiver", () =>
    Effect.gen(function* () {
      const fetch = vi.fn(function (this: unknown) {
        expect(this).toBe(globalThis);
        return Promise.resolve(Response.json({ sessions: [] }));
      }) as typeof globalThis.fetch;

      yield* listJudeSessions(fetch);

      expect(fetch).toHaveBeenCalledOnce();
    }),
  );

  it.effect("signs in to Jude and retries an unauthorized request", () =>
    Effect.gen(function* () {
      const authenticateJude = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("window", { desktopBridge: { authenticateJude } });
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(Response.json({ error: "not authenticated" }, { status: 401 }))
        .mockResolvedValueOnce(Response.json({ sessions: [] }));

      try {
        expect(yield* listJudeSessions(fetch)).toEqual([]);
        expect(authenticateJude).toHaveBeenCalledOnce();
        expect(fetch).toHaveBeenCalledTimes(2);
      } finally {
        vi.unstubAllGlobals();
      }
    }),
  );

  it.effect("requests a fresh pairing URL for an environment", () =>
    Effect.gen(function* () {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        Response.json({
          pairingUrl: "https://admin-fix-search.t3.jude.prezly.dev/pair#token=fresh",
          expiresAt: "2026-08-08T13:00:00Z",
          serverVersion: "0.0.31",
        }),
      );

      expect(yield* issueJudeT3Pairing("admin/fix", fetch)).toMatchObject({
        pairingUrl: "https://admin-fix-search.t3.jude.prezly.dev/pair#token=fresh",
      });
      expect(fetch).toHaveBeenCalledWith("/_p3/jude/api/sessions/admin%2Ffix/t3-pairing", {
        method: "POST",
      });
    }),
  );

  it.effect("creates a Jude session with the selected project settings", () =>
    Effect.gen(function* () {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        Response.json(
          {
            id: "website-improve-search",
            name: "Improve search",
            prompt: "Improve search",
            project: "website",
            status: "provisioning",
            urls: { t3: "" },
          },
          { status: 201 },
        ),
      );

      const input = {
        prompt: "Improve search",
        project: "website",
        model: "gpt-5.6-sol",
        baseRef: "main",
        githubIdentity: "coding-agent",
      };
      expect(yield* createJudeSession(input, fetch)).toMatchObject({
        id: "website-improve-search",
        status: "provisioning",
      });
      expect(getJudeSessionsSnapshot()[0]).toMatchObject({
        id: "website-improve-search",
        prompt: "Improve search",
        status: "provisioning",
      });
      expect(getCreatedJudeSessionIdsSnapshot()).toContain("website-improve-search");
      dismissCreatedJudeSession("website-improve-search");
      expect(getCreatedJudeSessionIdsSnapshot()).not.toContain("website-improve-search");
      expect(fetch).toHaveBeenCalledWith("/_p3/jude/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"prompt":"Improve search","project":"website","model":"gpt-5.6-sol","baseRef":"main","githubIdentity":"coding-agent"}',
      });
    }),
  );

  it("waits for provisioning and refreshes the managed environments", async () => {
    const provisioning = {
      id: "website-improve-search",
      name: "Improve search",
      prompt: "Improve search",
      project: "website",
      status: "provisioning",
      urls: { t3: "" },
    };
    const ready = {
      ...provisioning,
      status: "ready",
      urls: { t3: "https://website-improve-search.t3.jude.prezly.dev" },
    };
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(provisioning, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ sessions: [ready] }));
    const refreshListener = vi.fn();
    const unsubscribe = subscribeToJudeEnvironmentRefresh(refreshListener);

    await expect(
      provisionJudeProject(
        {
          prompt: "Improve search",
          project: "website",
          model: "gpt-5.6-sol",
          baseRef: "main",
        },
        { fetch, pollIntervalMs: 0 },
      ),
    ).resolves.toMatchObject({ status: "ready" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(refreshListener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it.effect("surfaces Jude failures as retryable environment failures", () =>
    Effect.gen(function* () {
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(null, { status: 503 }));

      const exit = yield* Effect.exit(listJudeSessions(fetch));
      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const error = Cause.squash(exit.cause);
        expect(error).toBeInstanceOf(ConnectionTransientError);
      }
    }),
  );
});
