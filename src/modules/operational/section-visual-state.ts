export type SectionCompletionState = "not_started" | "partial" | "complete";

export type SectionNavVisualState = SectionCompletionState | "current";

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
  options?: {
    isActive?: boolean;
    completion?: SectionCompletionState;
  },
): string {
  const tokens = [label];
  if (options?.isActive) {
    tokens.push("current");
  }
  const completion = options?.completion;
  if (completion === "complete" || visual === "complete") {
    tokens.push("completed");
  } else if (completion === "partial" || visual === "partial") {
    tokens.push("partially answered");
  } else if (!options?.isActive && visual === "not_started") {
    tokens.push("not started");
  }
  const stateText = tokens.slice(1).join(", ");
  if (detail) {
    return `${label}, ${stateText}, ${detail}`;
  }
  return stateText ? `${label}, ${stateText}` : label;
}
