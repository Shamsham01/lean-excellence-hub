import type { CoachEnvelope } from "@/platform/ai/types";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_FOLLOW_UPS = 3;
const MAX_LABEL = 80;
const MAX_ROUTE = 200;
const MAX_PERMISSION_NOTE = 400;

export function parseCoachEnvelope(value: unknown): CoachEnvelope {
  const record =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const message = sanitiseText(record.message, MAX_MESSAGE_LENGTH);
  if (!message) {
    throw new Error("Coach response was empty.");
  }
  const nextLabel = sanitiseText(record.next_step_label, MAX_LABEL);
  const nextRoute = sanitiseText(record.next_step_route, MAX_ROUTE);
  return {
    message,
    suggested_next_step:
      nextLabel && nextRoute && isSafeInternalRoute(nextRoute)
        ? { label: nextLabel, route: nextRoute }
        : parseNextStep(record.suggested_next_step),
    permission_note: sanitiseText(record.permission_note, MAX_PERMISSION_NOTE),
    follow_up_prompts: Array.isArray(record.follow_up_prompts)
      ? record.follow_up_prompts
          .map((entry) => sanitiseText(entry, 160))
          .filter((entry): entry is string => Boolean(entry))
          .slice(0, MAX_FOLLOW_UPS)
      : [],
  };
}

export function fallbackCoachEnvelope(message: string): CoachEnvelope {
  return {
    message:
      sanitiseText(message, MAX_MESSAGE_LENGTH) ||
      "LeanAI could not complete this explanation.",
    suggested_next_step: null,
    permission_note: null,
    follow_up_prompts: [],
  };
}

function parseNextStep(value: unknown): CoachEnvelope["suggested_next_step"] {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const label = sanitiseText(record.label, MAX_LABEL);
  const route = sanitiseText(record.route, MAX_ROUTE);
  if (!label || !route || !isSafeInternalRoute(route)) {
    return null;
  }
  return { label, route };
}

// Prevent protocol-relative destinations (//evil.example) and backslash/ASCII
// control-character URL parsing ambiguities before applying the stronger
// per-intervention allowlist in the Coach orchestrator.
function isSafeInternalRoute(route: string): boolean {
  return (
    route.startsWith("/") &&
    !route.startsWith("//") &&
    !route.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(route)
  );
}

function sanitiseText(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, max);
}
