type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

export type SupabaseErrorKind =
  | "authorization_denial"
  | "auth_session_failure"
  | "not_found"
  | "infrastructure";

export function readSupabaseErrorFields(error: unknown): {
  code: string | null;
  message: string | null;
} {
  if (!error || typeof error !== "object") {
    return {
      code: null,
      message: error instanceof Error ? error.message : null,
    };
  }

  const record = error as SupabaseLikeError;
  return {
    code: typeof record.code === "string" ? record.code : null,
    message: typeof record.message === "string" ? record.message : null,
  };
}

const AUTHORIZATION_DENIAL_CODES = new Set(["42501"]);
const AUTH_SESSION_FAILURE_CODES = new Set(["PGRST301"]);
const NOT_FOUND_CODES = new Set(["P0002"]);

function isTransportFailure(error: unknown, message: string | null): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  const normalizedMessage = message?.toLowerCase() ?? "";
  return (
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("connection") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("econnreset") ||
    normalizedMessage.includes("canceling statement")
  );
}

export function classifySupabaseError(error: unknown): SupabaseErrorKind | null {
  if (!error) {
    return null;
  }

  const { code, message } = readSupabaseErrorFields(error);

  if (code && AUTHORIZATION_DENIAL_CODES.has(code)) {
    return "authorization_denial";
  }

  if (code && AUTH_SESSION_FAILURE_CODES.has(code)) {
    return "auth_session_failure";
  }

  if (code && NOT_FOUND_CODES.has(code)) {
    return "not_found";
  }

  if (isTransportFailure(error, message)) {
    return "infrastructure";
  }

  if (code) {
    return "infrastructure";
  }

  if (message) {
    return "infrastructure";
  }

  return "infrastructure";
}

/** @deprecated Prefer classifySupabaseError for new code. */
export function isSupabasePermissionDenial(error: unknown): boolean {
  return classifySupabaseError(error) === "authorization_denial";
}

export function isSupabaseAuthSessionFailure(error: unknown): boolean {
  return classifySupabaseError(error) === "auth_session_failure";
}

export function isSupabaseNotFound(error: unknown): boolean {
  return classifySupabaseError(error) === "not_found";
}

export function isSupabaseInfrastructureError(error: unknown): boolean {
  return classifySupabaseError(error) === "infrastructure";
}

export type PermissionProbeClassification<T> =
  | { ok: true; data: T | null }
  | { ok: false; outcome: "denied" }
  | { ok: false; outcome: "auth_failure"; error: unknown }
  | { ok: false; outcome: "not_found"; error: unknown }
  | { ok: false; outcome: "infrastructure"; error: unknown };

export function classifyPermissionProbeResult<T>(input: {
  data: T | null;
  error: unknown;
}): PermissionProbeClassification<T> {
  if (input.error) {
    const kind = classifySupabaseError(input.error);

    switch (kind) {
      case "authorization_denial":
        return { ok: false, outcome: "denied" };
      case "auth_session_failure":
        return { ok: false, outcome: "auth_failure", error: input.error };
      case "not_found":
        return { ok: false, outcome: "not_found", error: input.error };
      default:
        return { ok: false, outcome: "infrastructure", error: input.error };
    }
  }

  return { ok: true, data: input.data };
}
