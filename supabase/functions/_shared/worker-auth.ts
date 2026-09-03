export type ParsedSupabaseSecretKeys = {
  keys: string[];
  preferredKey: string | null;
  parseError: boolean;
};

export type WorkerAuthConfigResult =
  | {
      configured: true;
      secretKeys: string[];
      legacyServiceRoleKey: string | null;
    }
  | {
      configured: false;
      reason: "missing_configuration" | "invalid_secret_keys_without_fallback";
    };

export type WorkerAuthResult =
  { ok: true } | { ok: false; status: 401 | 500; error: string };

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function readApiKey(request: Request): string | null {
  const apiKey = request.headers.get("apikey")?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : null;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function matchesConfiguredSecret(
  candidate: string | null,
  configuredSecrets: string[],
): boolean {
  if (candidate === null) {
    return false;
  }

  for (const secret of configuredSecrets) {
    if (constantTimeEqual(candidate, secret)) {
      return true;
    }
  }

  return false;
}

export function parseSupabaseSecretKeys(
  raw: string | undefined,
): ParsedSupabaseSecretKeys {
  if (!raw?.trim()) {
    return { keys: [], preferredKey: null, parseError: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { keys: [], preferredKey: null, parseError: true };
    }

    const keys: string[] = [];
    for (const value of Object.values(parsed)) {
      if (typeof value !== "string") {
        continue;
      }

      const trimmed = value.trim();
      if (trimmed.length > 0) {
        keys.push(trimmed);
      }
    }

    return {
      keys,
      preferredKey: keys[0] ?? null,
      parseError: false,
    };
  } catch {
    return { keys: [], preferredKey: null, parseError: true };
  }
}

export function resolveWorkerAuthConfig(
  readEnv: (name: string) => string | undefined,
): WorkerAuthConfigResult {
  const secretKeysRaw = readEnv("SUPABASE_SECRET_KEYS");
  const legacyServiceRoleKey =
    readEnv("SUPABASE_SERVICE_ROLE_KEY")?.trim() || null;
  const parsed = parseSupabaseSecretKeys(secretKeysRaw);
  const hasSecretKeysEnv = Boolean(secretKeysRaw?.trim());
  const hasValidSecretKeys = parsed.keys.length > 0;
  const hasLegacyServiceRoleKey = Boolean(legacyServiceRoleKey);

  if (!hasSecretKeysEnv && !hasLegacyServiceRoleKey) {
    return { configured: false, reason: "missing_configuration" };
  }

  if (hasSecretKeysEnv && !hasValidSecretKeys && !hasLegacyServiceRoleKey) {
    return {
      configured: false,
      reason: "invalid_secret_keys_without_fallback",
    };
  }

  return {
    configured: true,
    secretKeys: parsed.keys,
    legacyServiceRoleKey,
  };
}

export function resolvePrivilegedSupabaseKey(
  readEnv: (name: string) => string | undefined,
): string | null {
  const config = resolveWorkerAuthConfig(readEnv);
  if (!config.configured) {
    return null;
  }

  return config.secretKeys[0] ?? config.legacyServiceRoleKey;
}

export function authenticateNotificationWorkerRequest(
  request: Request,
  readEnv: (name: string) => string | undefined,
): WorkerAuthResult {
  const config = resolveWorkerAuthConfig(readEnv);
  if (!config.configured) {
    if (config.reason === "missing_configuration") {
      return { ok: false, status: 500, error: "Worker is not configured." };
    }

    return { ok: false, status: 401, error: "Unauthorized." };
  }

  const apiKey = readApiKey(request);
  const bearerToken = readBearerToken(request);

  const apiKeyMatches = matchesConfiguredSecret(apiKey, config.secretKeys);
  const bearerMatches =
    bearerToken !== null &&
    config.legacyServiceRoleKey !== null &&
    constantTimeEqual(bearerToken, config.legacyServiceRoleKey);

  if (apiKeyMatches || bearerMatches) {
    return { ok: true };
  }

  return { ok: false, status: 401, error: "Unauthorized." };
}
