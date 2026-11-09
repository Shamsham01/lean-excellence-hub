export type SectionCompletionState = "not_started" | "partial" | "complete";

export type SectionNavVisualState =
  | SectionCompletionState
  | "current";

export function deriveSectionCompletionState(
  answeredCount: number,
  totalCount: number,
): SectionCompletionState {
  if (totalCount <= 0) {
    return "complete";
  }
  if (answeredCount <= 0) {
    return "not_started";
  }
  if (answeredCount >= totalCount) {
    return "complete";
  }
  return "partial";
}

export function sectionNavVisualState(
  completion: SectionCompletionState,
  isActive: boolean,
): SectionNavVisualState {
  return isActive ? "current" : completion;
}

export function sectionNavAriaLabel(
  label: string,
  visual: SectionNavVisualState,
  detail?: string,
): string {
  const stateLabel =
    visual === "current"
      ? "current"
      : visual === "complete"
        ? "completed"
        : visual === "partial"
          ? "partially answered"
          : "not started";
  return detail ? `${label}, ${stateLabel}, ${detail}` : `${label}, ${stateLabel}`;
}
