import { MATURITY_BUILDER_ROUTE } from "@/modules/maturity/ai-builder/types";

/**
 * Routes that host their own LeanAI conversation. The global assistant chrome
 * is hidden here; its provider, conversation and open preference stay mounted.
 */
const DEDICATED_LEANAI_ROUTES = [MATURITY_BUILDER_ROUTE] as const;

export function isDedicatedLeanAiRoute(pathname: string): boolean {
  const path = pathname.trim().split("?")[0]?.replace(/\/+$/, "") || "/";
  return DEDICATED_LEANAI_ROUTES.some((route) => path === route);
}
