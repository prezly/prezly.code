import { ConnectionTransientError } from "@t3tools/client-runtime/connection";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { describe, expect, it, vi } from "vite-plus/test";

import { issueJudeT3Pairing, listJudeSessions } from "./jude.ts";

describe("Jude discovery", () => {
  it("reads the authoritative session list", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          sessions: [
            {
              id: "admin-fix-search",
              name: "Fix search",
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
        status: "ready",
        urls: { t3: "https://admin-fix-search.t3.jude.prezly.dev" },
      },
    ]);
    expect(fetch).toHaveBeenCalledWith("/_p3/jude/api/sessions", { method: "GET" });
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
