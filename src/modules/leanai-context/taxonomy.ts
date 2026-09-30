import { LEANAI_FORBIDDEN_METADATA_KEYS } from "./privacy";
import {
  LEANAI_MODULE_KEYS,
  LEANAI_SEMANTIC_EVENT_KEYS,
  type LeanAiModuleKey,
  type LeanAiSemanticEventInput,
  type LeanAiSemanticEventKey,
} from "./types";

export const LEANAI_SEMANTIC_EVENT_VERSION = 1;
export const LEANAI_METADATA_MAX_KEYS = 16;
export const LEANAI_METADATA_MAX_STRING_LENGTH = 200;
export const LEANAI_INTERVENTION_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;
export const LEANAI_STEP_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;
export const LEANAI_SNOOZE_MINUTES_MIN = 15;
export const LEANAI_SNOOZE_MINUTES_MAX = 10_080;

const EVENT_KEY_SET = new Set<string>(LEANAI_SEMANTIC_EVENT_KEYS);
const MODULE_KEY_SET = new Set<string>(LEANAI_MODULE_KEYS);
const FORBIDDEN_METADATA_KEY_SET = new Set<string>(
  LEANAI_FORBIDDEN_METADATA_KEYS,
);

export function isLeanAiSemanticEventKey(
  value: string,
): value is LeanAiSemanticEventKey {
  return EVENT_KEY_SET.has(value);
}

export function isLeanAiModuleKey(value: string): value is LeanAiModuleKey {
  return MODULE_KEY_SET.has(value);
}

export type LeanAiEventValidationError = {
  field: string;
  message: string;
};

function isPlainMetadataRecord(
  value: unknown,
): value is Record<string, string | number | boolean | null> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.getPrototypeOf(value) === Object.prototype;
}

export function validateLeanAiSemanticEventInput(
  input: LeanAiSemanticEventInput,
): LeanAiEventValidationError[] {
  const errors: LeanAiEventValidationError[] = [];

  if (!isLeanAiSemanticEventKey(input.eventKey)) {
    errors.push({
      field: "eventKey",
      message: "Event key is not in the bounded LeanAI taxonomy.",
    });
  }

  const eventVersion = input.eventVersion ?? LEANAI_SEMANTIC_EVENT_VERSION;
  if (eventVersion !== LEANAI_SEMANTIC_EVENT_VERSION) {
    errors.push({
      field: "eventVersion",
      message: `Only event version ${LEANAI_SEMANTIC_EVENT_VERSION} is accepted.`,
    });
  }

  if (input.moduleKey !== undefined && !isLeanAiModuleKey(input.moduleKey)) {
    errors.push({
      field: "moduleKey",
      message: "Module key is not in the bounded LeanAI module list.",
    });
  }

  if (input.eventKey === "module.opened" && !input.moduleKey) {
    errors.push({
      field: "moduleKey",
      message: "module.opened requires a bounded module key.",
    });
  }

  if (
    input.eventKey.startsWith("leanai.intervention_") &&
    !input.interventionKey
  ) {
    errors.push({
      field: "interventionKey",
      message: "Intervention events require an intervention key.",
    });
  }

  if (
    input.interventionKey !== undefined &&
    !LEANAI_INTERVENTION_KEY_PATTERN.test(input.interventionKey)
  ) {
    errors.push({
      field: "interventionKey",
      message: "Intervention key must be a bounded identifier.",
    });
  }

  const metadata = input.metadata ?? {};
  if (!isPlainMetadataRecord(metadata)) {
    errors.push({
      field: "metadata",
      message: "Metadata must be a flat object with bounded scalar values.",
    });
    return errors;
  }

  const metadataKeys = Object.keys(metadata);
  if (metadataKeys.length > LEANAI_METADATA_MAX_KEYS) {
    errors.push({
      field: "metadata",
      message: `Metadata may contain at most ${LEANAI_METADATA_MAX_KEYS} keys.`,
    });
  }

  for (const key of metadataKeys) {
    if (!LEANAI_STEP_KEY_PATTERN.test(key)) {
      errors.push({
        field: `metadata.${key}`,
        message: "Metadata keys must be bounded identifiers.",
      });
    }
    if (FORBIDDEN_METADATA_KEY_SET.has(key)) {
      errors.push({
        field: `metadata.${key}`,
        message: "Metadata must not record surveillance or secret fields.",
      });
    }
    const value = metadata[key];
    if (
      typeof value === "string" &&
      value.length > LEANAI_METADATA_MAX_STRING_LENGTH
    ) {
      errors.push({
        field: `metadata.${key}`,
        message: "Metadata strings must stay within the bounded length.",
      });
    }
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      errors.push({
        field: `metadata.${key}`,
        message: "Metadata values must be string, number, boolean, or null.",
      });
    }
  }

  if (
    input.eventKey === "onboarding.step_completed" ||
    input.eventKey === "onboarding.step_skipped"
  ) {
    const stepKey = metadata.step_key;
    if (typeof stepKey !== "string" || !LEANAI_STEP_KEY_PATTERN.test(stepKey)) {
      errors.push({
        field: "metadata.step_key",
        message: "Onboarding step events require a bounded step_key.",
      });
    }
  }

  if (input.eventKey === "leanai.intervention_snoozed") {
    const snoozeMinutes = metadata.snooze_minutes;
    if (
      typeof snoozeMinutes !== "number" ||
      !Number.isInteger(snoozeMinutes) ||
      snoozeMinutes < LEANAI_SNOOZE_MINUTES_MIN ||
      snoozeMinutes > LEANAI_SNOOZE_MINUTES_MAX
    ) {
      errors.push({
        field: "metadata.snooze_minutes",
        message:
          "Snooze events require snooze_minutes within the allowed window.",
      });
    }
  }

  return errors;
}
