import { getServerEnvironment } from "@/platform/env";

export const AUTH_CONTINUE_PATH = "/auth/continue";

export function postSignInRedirectPath(path: string): string {
  return path === "/" ? AUTH_CONTINUE_PATH : path;
}

export function safeRelativeRedirect(value: string | null, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  const origin = new URL(getServerEnvironment().APP_ORIGIN);
  const target = new URL(value, origin);
  return target.origin === origin.origin
    ? `${target.pathname}${target.search}${target.hash}`
    : fallback;
}
