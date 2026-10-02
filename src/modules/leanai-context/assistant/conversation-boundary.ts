/**
 * Logical conversation start for the workspace assistant.
 *
 * The boundary may hide prior session messages and reset the per-conversation
 * 24-turn guard. It must never be used to reset organisation AI usage,
 * token ceilings, entitlements, or permissions.
 */

export const CONVERSATION_BOUNDARY_MAX_FUTURE_MS = 120_000;

export type ConversationBoundaryParse =
  { kind: "none" } | { kind: "valid"; startedAt: string } | { kind: "invalid" };

function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}

export function parseConversationBoundary(
  value: unknown,
): ConversationBoundaryParse {
  if (value == null || value === "") {
    return { kind: "none" };
  }
  if (typeof value !== "string") {
    return { kind: "invalid" };
  }
  const trimmed = value.trim();
  if (!isIsoDateTime(trimmed)) {
    return { kind: "invalid" };
  }
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    return { kind: "invalid" };
  }
  if (ms - Date.now() > CONVERSATION_BOUNDARY_MAX_FUTURE_MS) {
    return { kind: "invalid" };
  }
  return { kind: "valid", startedAt: new Date(ms).toISOString() };
}

export function validateConversationBoundary(value: unknown): string | null {
  const parsed = parseConversationBoundary(value);
  return parsed.kind === "valid" ? parsed.startedAt : null;
}

/**
 * Missing boundary → no filter. Invalid boundary → fail closed (now), so
 * pre-boundary history is not exposed.
 */
export function failClosedConversationStartedAt(value: unknown): string | null {
  const parsed = parseConversationBoundary(value);
  if (parsed.kind === "none") {
    return null;
  }
  if (parsed.kind === "valid") {
    return parsed.startedAt;
  }
  return new Date().toISOString();
}

export function isTimestampOnOrAfter(
  createdAt: unknown,
  startedAt: string,
): boolean {
  if (typeof createdAt !== "string" || createdAt.trim().length === 0) {
    return false;
  }
  const createdMs = Date.parse(createdAt);
  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(createdMs) || !Number.isFinite(startedMs)) {
    return false;
  }
  return createdMs >= startedMs;
}

export function filterConversationAfterBoundary<
  T extends { createdAt?: string | null; created_at?: unknown },
>(messages: readonly T[], startedAt: string | null): T[] {
  if (!startedAt) {
    return [...messages];
  }
  return messages.filter((message) =>
    isTimestampOnOrAfter(message.createdAt ?? message.created_at, startedAt),
  );
}

export function countUserTurnsAfterBoundary(
  messages: readonly {
    role?: unknown;
    createdAt?: string | null;
    created_at?: unknown;
  }[],
  startedAt: string | null,
): number {
  return filterConversationAfterBoundary(messages, startedAt).filter(
    (message) => message.role === "user",
  ).length;
}
