import type { ServerEnvironment } from "@/platform/env";
import { getServerEnvironment } from "@/platform/env";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export const APPLICATION_ORIGIN_CONFIGURATION_ERROR =
  "Invitation links cannot be generated because the application URL is not configured. Ask your platform administrator to set APP_ORIGIN to the deployed Lean Excellence Hub URL.";

export type ApplicationOriginResult =
  { ok: true; origin: string } | { ok: false; error: string };

type ResolveApplicationOriginOptions = {
  environment?: Pick<ServerEnvironment, "APP_ORIGIN" | "NODE_ENV">;
  requestHeaders?: Headers;
};

export function normalizeApplicationOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

export function isLocalApplicationOrigin(origin: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return true;
  }
}

export function deriveApplicationOriginFromHeaders(
  requestHeaders: Headers,
): string | null {
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  if (!host) {
    return null;
  }

  const primaryHost = host.split(",")[0]?.trim();
  if (!primaryHost) {
    return null;
  }

  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol?.split(",")[0]?.trim() || "https";

  try {
    return normalizeApplicationOrigin(`${protocol}://${primaryHost}`);
  } catch {
    return null;
  }
}

export function resolveApplicationOrigin(
  options: ResolveApplicationOriginOptions = {},
): ApplicationOriginResult {
  const environment = options.environment ?? getServerEnvironment();
  const configuredOrigin = normalizeApplicationOrigin(environment.APP_ORIGIN);

  if (!isLocalApplicationOrigin(configuredOrigin)) {
    return { ok: true, origin: configuredOrigin };
  }

  const derivedOrigin = options.requestHeaders
    ? deriveApplicationOriginFromHeaders(options.requestHeaders)
    : null;

  if (derivedOrigin && !isLocalApplicationOrigin(derivedOrigin)) {
    return { ok: true, origin: derivedOrigin };
  }

  if (
    environment.NODE_ENV === "development" ||
    environment.NODE_ENV === "test"
  ) {
    return { ok: true, origin: configuredOrigin };
  }

  return {
    ok: false,
    error: APPLICATION_ORIGIN_CONFIGURATION_ERROR,
  };
}

export function buildInvitationUrl(origin: string, token: string): string {
  return `${normalizeApplicationOrigin(origin)}/invitations/${token}`;
}
