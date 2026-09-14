export const PLATFORM_BOUNDARY_LOG_PREFIX = "[platform-boundary]";

export const PLATFORM_BOUNDARY_USER_MESSAGE =
  "This workspace couldn’t load. Reload to try again.";

export type PlatformBoundaryCategory =
  | "auth"
  | "identity"
  | "organisation_access"
  | "active_site"
  | "permission"
  | "request";

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

export type PlatformBoundaryLog = {
  category: PlatformBoundaryCategory;
  operation: string;
  reference: string;
  route?: string | null;
  digest?: string | null;
  permissionKey?: string | null;
  supabaseCode?: string | null;
  supabaseMessage?: string | null;
  routeType?: string | null;
  renderSource?: string | null;
};

export class PlatformBoundaryError extends Error {
  readonly category: PlatformBoundaryCategory;
  readonly operation: string;
  readonly reference: string;

  constructor(input: {
    category: PlatformBoundaryCategory;
    operation: string;
    reference: string;
  }) {
    super(formatPlatformBoundaryUserMessage(input.reference));
    this.name = "PlatformBoundaryError";
    this.category = input.category;
    this.operation = input.operation;
    this.reference = input.reference;
  }
}

const SENSITIVE_PATTERN =
  /eyJ[\w-]+\.[\w-]+\.[\w-]+|bearer\s+\S+|authorization\s*[:=]|cookie\s*[:=]|password\s*[:=]|refresh_token|access_token/i;

export function formatPlatformBoundaryUserMessage(reference: string) {
  return `${PLATFORM_BOUNDARY_USER_MESSAGE} Reference ${reference}.`;
}

export function createPlatformBoundaryReference() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `ref-${Date.now().toString(36)}`;
}

export function sanitizeBoundaryMessage(
  message: string | null | undefined,
): string | null {
  if (!message) {
    return null;
  }

  const trimmed = message.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!trimmed) {
    return null;
  }
  if (SENSITIVE_PATTERN.test(trimmed)) {
    return "[redacted]";
  }
  return trimmed;
}

export function isNextNavigationError(error: unknown) {
  if (!error || typeof error !== "object" || !("digest" in error)) {
    return false;
  }

  const digest = error.digest;
  if (typeof digest !== "string") {
    return false;
  }

  return (
    digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")
  );
}

export function readErrorDigest(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("digest" in error)) {
    return null;
  }

  const digest = error.digest;
  if (typeof digest !== "string" || digest.length === 0 || digest.length > 80) {
    return null;
  }

  return digest;
}

export function logPlatformBoundaryError(entry: PlatformBoundaryLog) {
  console.error(
    PLATFORM_BOUNDARY_LOG_PREFIX,
    JSON.stringify({
      category: entry.category,
      operation: entry.operation,
      reference: entry.reference,
      route: entry.route ?? null,
      digest: entry.digest ?? null,
      permissionKey: entry.permissionKey ?? null,
      supabaseCode: entry.supabaseCode ?? null,
      supabaseMessage: sanitizeBoundaryMessage(entry.supabaseMessage),
      routeType: entry.routeType ?? null,
      renderSource: entry.renderSource ?? null,
    }),
  );
}

export function throwPlatformBoundaryError(input: {
  category: Exclude<PlatformBoundaryCategory, "permission">;
  operation: string;
  route?: string | null;
  supabaseError?: SupabaseLikeError | null;
  cause?: unknown;
}): never {
  const reference = createPlatformBoundaryReference();
  logPlatformBoundaryError({
    category: input.category,
    operation: input.operation,
    reference,
    route: input.route ?? null,
    supabaseCode: input.supabaseError?.code ?? null,
    supabaseMessage:
      input.supabaseError?.message ??
      (input.cause instanceof Error ? input.cause.message : null),
  });

  throw new PlatformBoundaryError({
    category: input.category,
    operation: input.operation,
    reference,
  });
}
