import { getServerEnvironment } from "@/platform/env";

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
