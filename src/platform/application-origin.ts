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

export function canonicalApplicationRedirectOrigin(
  environment: Pick<ServerEnvironment, "APP_ORIGIN">,
): string {
  return normalizeApplicationOrigin(environment.APP_ORIGIN);
}

export function buildCanonicalRedirectUrl(
  path: string,
  environment: Pick<ServerEnvironment, "APP_ORIGIN">,
): URL {
  return new URL(path, canonicalApplicationRedirectOrigin(environment));
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

function localOriginsMatch(actual: string, expected: string): boolean {
  if (actual === expected) {
    return true;
  }

  try {
    const actualUrl = new URL(actual);
    const expectedUrl = new URL(expected);
    return (
      LOCAL_HOSTNAMES.has(actualUrl.hostname) &&
      LOCAL_HOSTNAMES.has(expectedUrl.hostname) &&
      actualUrl.port === expectedUrl.port &&
      actualUrl.protocol === expectedUrl.protocol
    );
  } catch {
    return false;
  }
}

function isSameOriginHtmlFormNavigation(
  request: Pick<Request, "headers">,
): boolean {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== "null") {
    return false;
  }

  if (request.headers.get("referer")) {
    return false;
  }

  return (
    request.headers.get("sec-fetch-site") === "same-origin" &&
    request.headers.get("sec-fetch-mode") === "navigate" &&
    request.headers.get("sec-fetch-dest") === "document"
  );
}

export function requestHasTrustedOrigin(
  request: Pick<Request, "headers">,
  environment: Pick<ServerEnvironment, "APP_ORIGIN">,
): boolean {
  const expectedOrigin = new URL(environment.APP_ORIGIN).origin;
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== "null" &&
    localOriginsMatch(origin, expectedOrigin)
  ) {
    return true;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (localOriginsMatch(new URL(referer).origin, expectedOrigin)) {
        return true;
      }
    } catch {
      // Fall through to additional checks.
    }
  }

  return isSameOriginHtmlFormNavigation(request);
}
