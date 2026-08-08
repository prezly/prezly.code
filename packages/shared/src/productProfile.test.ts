import { describe, expect, it } from "vite-plus/test";

import { resolveProductProfile } from "./productProfile.ts";

describe("resolveProductProfile", () => {
  it("keeps T3 as the default profile", () => {
    expect(resolveProductProfile(undefined)).toMatchObject({
      id: "t3",
      baseName: "T3 Code",
      capabilities: {
        allowLocalEnvironment: true,
        allowWorktreeManagement: true,
        fixedWorkspaceRoot: null,
      },
    });
  });

  it("defines P3 as a Jude-managed remote-only product", () => {
    expect(resolveProductProfile(" P3 ")).toEqual({
      id: "p3",
      baseName: "Prezly.code",
      judeBaseUrl: "https://jude.prezly.net",
      capabilities: {
        allowLocalEnvironment: false,
        allowManualConnections: false,
        allowProjectManagement: false,
        allowUsageInsights: false,
        allowWorktreeManagement: false,
        fixedWorkspaceRoot: "/source",
        managedProjects: true,
      },
      desktop: {
        appId: "com.prezly.p3code",
        applicationName: "Prezly code",
        executableName: "p3code",
        homeDirectoryName: ".p3",
        protocolScheme: "p3code",
        stateDirectoryName: "p3code",
      },
    });
  });

  it("falls back safely for unknown product values", () => {
    expect(resolveProductProfile("unknown").id).toBe("t3");
  });
});
