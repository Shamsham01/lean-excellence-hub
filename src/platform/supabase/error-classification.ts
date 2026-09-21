type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

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

const PERMISSION_DENIAL_CODES = new Set(["42501", "PGRST301"]);

export function isSupabasePermissionDenial(error: unknown): boolean {
  const { code } = readSupabaseErrorFields(error);
  return code !== null && PERMISSION_DENIAL_CODES.has(code);
}

export function isSupabaseInfrastructureError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (isSupabasePermissionDenial(error)) {
    return false;
  }

  const { code, message } = readSupabaseErrorFields(error);
  if (code) {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  const normalizedMessage = message?.toLowerCase() ?? "";
  return (
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("connection") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("econnreset")
  );
}

export function classifyPermissionProbeResult<T>(input: {
  data: T | null;
  error: unknown;
}):
  | { ok: true; data: T | null }
  | { ok: false; denied: true }
  | { ok: false; denied: false; error: unknown } {
  if (input.error) {
    if (isSupabasePermissionDenial(input.error)) {
      return { ok: false, denied: true };
    }

    return { ok: false, denied: false, error: input.error };
  }

  return { ok: true, data: input.data };
}
