import { MATURITY_BUILDER_ROUTE } from "@/modules/maturity/ai-builder/types";

/**
 * Routes that host their own LeanAI conversation. The global assistant chrome
 * is hidden here; its provider, conversation and open preference stay mounted.
 */
const DEDICATED_LEANAI_ROUTES = [MATURITY_BUILDER_ROUTE] as const;

function normalizePath(pathname: string): string {
  return pathname.trim().split("?")[0]?.replace(/\/+$/, "") || "/";
}

/** Active case workspace hosts its own Lean AI facilitator dock. */
export function isProblemSolvingCaseWorkspace(pathname: string): boolean {
  const path = normalizePath(pathname);
  return /^\/platform\/problem-solving\/(?!new$)[^/]+$/.test(path);
}

export function isDedicatedLeanAiRoute(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (isProblemSolvingCaseWorkspace(path)) {
    return true;
  }
  return DEDICATED_LEANAI_ROUTES.some((route) => path === route);
}
