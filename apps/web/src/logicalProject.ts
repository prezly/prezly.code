export {
  buildProjectGroups,
  deriveLogicalProjectKey,
  deriveLogicalProjectKeyFromRef,
  deriveLogicalProjectKeyFromSettings,
  derivePhysicalProjectKey,
  derivePhysicalProjectKeyFromPath,
  deriveProjectGroupLabel,
  deriveProjectGroupingOverrideKey,
  getProjectOrderKey,
  resolveProjectGroupingMode,
  type ProjectGroupingMode,
  type ProjectGroupingSettings,
  type ProjectGroup,
  type ProjectGroupMember,
} from "@t3tools/client-runtime/state/project-grouping";
import {
  selectProjectGroupingSettings as selectRuntimeProjectGroupingSettings,
  type ProjectGroupingSettings,
} from "@t3tools/client-runtime/state/project-grouping";
import type { ClientSettings } from "@t3tools/contracts/settings";

import { PRODUCT_CAPABILITIES } from "./branding";

export function resolveProductProjectGroupingSettings(
  settings: ProjectGroupingSettings,
  managedProjects: boolean,
): ProjectGroupingSettings {
  if (!managedProjects) return settings;

  return {
    sidebarProjectGroupingMode: "separate",
    sidebarProjectGroupingOverrides: {},
  };
}

export function selectProjectGroupingSettings(settings: ClientSettings): ProjectGroupingSettings {
  return resolveProductProjectGroupingSettings(
    selectRuntimeProjectGroupingSettings(settings),
    PRODUCT_CAPABILITIES.managedProjects,
  );
}
