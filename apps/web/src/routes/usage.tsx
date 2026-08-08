import { createFileRoute, redirect } from "@tanstack/react-router";

import { UsagePage } from "../components/usage/UsagePage";
import { PRODUCT_CAPABILITIES } from "../branding";

export const Route = createFileRoute("/usage")({
  beforeLoad: () => {
    if (!PRODUCT_CAPABILITIES.allowUsageInsights) {
      throw redirect({ to: "/" });
    }
  },
  component: UsagePage,
});
