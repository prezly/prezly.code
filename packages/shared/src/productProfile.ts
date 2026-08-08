export type ProductProfileId = "t3" | "p3";

export interface ProductCapabilities {
  readonly allowLocalEnvironment: boolean;
  readonly allowManualConnections: boolean;
  readonly allowProjectManagement: boolean;
  readonly allowWorktreeManagement: boolean;
  readonly fixedWorkspaceRoot: string | null;
  readonly managedProjects: boolean;
}

export interface ProductProfile {
  readonly id: ProductProfileId;
  readonly baseName: string;
  readonly judeBaseUrl: string | null;
  readonly capabilities: ProductCapabilities;
  readonly desktop: {
    readonly appId: string;
    readonly applicationName: string | null;
    readonly executableName: string;
    readonly homeDirectoryName: string;
    readonly protocolScheme: string;
    readonly stateDirectoryName: string;
  };
}

const T3_PRODUCT_PROFILE: ProductProfile = {
  id: "t3",
  baseName: "T3 Code",
  judeBaseUrl: null,
  capabilities: {
    allowLocalEnvironment: true,
    allowManualConnections: true,
    allowProjectManagement: true,
    allowWorktreeManagement: true,
    fixedWorkspaceRoot: null,
    managedProjects: false,
  },
  desktop: {
    appId: "com.t3tools.t3code",
    applicationName: null,
    executableName: "t3code",
    homeDirectoryName: ".t3",
    protocolScheme: "t3code",
    stateDirectoryName: "t3code",
  },
};

const P3_PRODUCT_PROFILE: ProductProfile = {
  id: "p3",
  baseName: "Prezly.code",
  judeBaseUrl: "https://jude.prezly.net",
  capabilities: {
    allowLocalEnvironment: false,
    allowManualConnections: false,
    allowProjectManagement: false,
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
};

export function resolveProductProfile(value: string | null | undefined): ProductProfile {
  return value?.trim().toLowerCase() === "p3" ? P3_PRODUCT_PROFILE : T3_PRODUCT_PROFILE;
}
