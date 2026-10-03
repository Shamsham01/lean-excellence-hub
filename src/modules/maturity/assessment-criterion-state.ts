/**
 * Stable current-criterion preservation.
 *
 * Selected criterion is the criterion UUID, not a flattened array index.
 * RSC refreshes after answer, comment, evidence, or action mutations remount
 * client state. To keep the assessor on the same criterion:
 *
 * 1. Persist the id in sessionStorage keyed by assessment id.
 * 2. Mirror it on the URL as `?criterion=<uuid>` via history.replaceState
 *    so reloads and shareable links restore the same place without a Next.js
 *    navigation (no router.refresh / router.replace churn).
 * 3. Dispatch a location-change event so LeanAI can read the updated search
 *    string without a model call.
 */
import { AUTHORING_STEP_CHANGE_EVENT } from "@/lib/authoring/authoring-query";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCriterionUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export const ASSESSMENT_CRITERION_PARAM = "criterion";
export const ASSESSMENT_QUESTION_PARAM = "question";

const STORAGE_PREFIX = "maturity-assessment-criterion:";

export function assessmentCriterionStorageKey(assessmentId: string): string {
  return `${STORAGE_PREFIX}${assessmentId}`;
}

export function readStoredCriterionId(assessmentId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.sessionStorage.getItem(
      assessmentCriterionStorageKey(assessmentId),
    );
    return isCriterionUuid(value) ? value : null;
  } catch {
    return null;
  }
}

export function persistCriterionSelection(input: {
  assessmentId: string;
  criterionId: string;
  questionId?: string | null;
}): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      assessmentCriterionStorageKey(input.assessmentId),
      input.criterionId,
    );
  } catch {
    // sessionStorage may be unavailable.
  }

  const url = new URL(window.location.href);
  url.searchParams.set(ASSESSMENT_CRITERION_PARAM, input.criterionId);
  if (input.questionId && isCriterionUuid(input.questionId)) {
    url.searchParams.set(ASSESSMENT_QUESTION_PARAM, input.questionId);
  } else {
    url.searchParams.delete(ASSESSMENT_QUESTION_PARAM);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.replaceState(window.history.state, "", next);
    window.dispatchEvent(new Event(AUTHORING_STEP_CHANGE_EVENT));
  }
}

export function resolveInitialCriterionId(input: {
  assessmentId: string;
  criterionIds: readonly string[];
  urlCriterionId?: string | null;
}): string | null {
  if (input.criterionIds.length === 0) {
    return null;
  }
  const candidates = [
    input.urlCriterionId,
    readStoredCriterionId(input.assessmentId),
  ];
  for (const candidate of candidates) {
    if (candidate && input.criterionIds.includes(candidate)) {
      return candidate;
    }
  }
  return input.criterionIds[0] ?? null;
}
