const UNANSWERED_PATTERN =
  /required maturity assessment questions are unanswered/i;
const NOT_COMPLETABLE_PATTERN = /self assessment is not completable/i;
const NOT_SUBMITTABLE_PATTERN = /maturity assessment is not submittable/i;
const NOT_AUTHORISED_PATTERN =
  /not authorised|not authorized|permission|denied/i;
const INVALID_STATE_PATTERN =
  /not (completable|submittable|approvable|publishable)|invalid lifecycle|cannot/i;

export function isExpectedMaturityLifecycleError(message: string): boolean {
  return (
    UNANSWERED_PATTERN.test(message) ||
    NOT_COMPLETABLE_PATTERN.test(message) ||
    NOT_SUBMITTABLE_PATTERN.test(message) ||
    NOT_AUTHORISED_PATTERN.test(message) ||
    INVALID_STATE_PATTERN.test(message)
  );
}

export function maturityLifecycleErrorMessage(
  raw: string,
  remainingRequired?: number,
): string {
  if (UNANSWERED_PATTERN.test(raw)) {
    if (remainingRequired === 1) {
      return "1 required response remaining. Review missing responses before completing.";
    }
    if (remainingRequired != null && remainingRequired > 1) {
      return `${remainingRequired} required responses remaining. Review missing responses before completing.`;
    }
    return "Required responses are still missing. Review missing responses before completing.";
  }
  if (NOT_AUTHORISED_PATTERN.test(raw)) {
    return "You do not have permission to perform this assessment action.";
  }
  if (NOT_COMPLETABLE_PATTERN.test(raw) || NOT_SUBMITTABLE_PATTERN.test(raw)) {
    return "This assessment is not in a state that can accept that action yet.";
  }
  return raw;
}
