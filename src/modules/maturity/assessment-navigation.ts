import type { AssessmentPillar } from "@/modules/maturity/assessment-workspace-types";

/**
 * Instant criterion jumps avoid a long smooth pan across tall assessment
 * pages. `auto` also satisfies prefers-reduced-motion.
 */
export const ASSESSMENT_NAV_SCROLL_BEHAVIOR: ScrollBehavior = "auto";

export type AssessmentNavPosition = {
  currentPillarIndex: number;
  totalPillars: number;
  currentCriterionIndexWithinPillar: number;
  criteriaInCurrentPillar: number;
  globalCriterionIndex: number;
  totalCriteria: number;
};

export function buildAssessmentNavPosition(
  pillars: readonly AssessmentPillar[],
  criterionId: string,
): AssessmentNavPosition {
  const totalPillars = pillars.length;
  const totalCriteria = pillars.reduce(
    (sum, pillar) => sum + pillar.criteria.length,
    0,
  );
  let globalCriterionIndex = 0;

  for (let pillarIndex = 0; pillarIndex < pillars.length; pillarIndex += 1) {
    const pillar = pillars[pillarIndex];
    if (!pillar) {
      continue;
    }
    const criteriaInCurrentPillar = pillar.criteria.length;
    for (
      let criterionIndex = 0;
      criterionIndex < criteriaInCurrentPillar;
      criterionIndex += 1
    ) {
      globalCriterionIndex += 1;
      if (pillar.criteria[criterionIndex]?.id !== criterionId) {
        continue;
      }
      return {
        currentPillarIndex: pillarIndex + 1,
        totalPillars,
        currentCriterionIndexWithinPillar: criterionIndex + 1,
        criteriaInCurrentPillar,
        globalCriterionIndex,
        totalCriteria,
      };
    }
  }

  return {
    currentPillarIndex: totalPillars === 0 ? 0 : 1,
    totalPillars,
    currentCriterionIndexWithinPillar: 0,
    criteriaInCurrentPillar: pillars[0]?.criteria.length ?? 0,
    globalCriterionIndex: 0,
    totalCriteria,
  };
}

export function formatAssessmentNavPosition(
  position: AssessmentNavPosition,
): string {
  return `Pillar ${position.currentPillarIndex} of ${position.totalPillars} · Criterion ${position.currentCriterionIndexWithinPillar} of ${position.criteriaInCurrentPillar}`;
}

export type AssessmentScrollIntent =
  { kind: "criterion-top" } | { kind: "question"; questionId: string };

function resolvePlatformMainViewport(
  node: HTMLElement | null,
): HTMLElement | null {
  if (node) {
    const closest = node.closest(
      ".platform-main-viewport",
    ) as HTMLElement | null;
    if (closest) {
      return closest;
    }
  }
  return document.querySelector(
    ".platform-main-viewport",
  ) as HTMLElement | null;
}

function scrollWithinPlatformViewport(
  element: HTMLElement,
  block: "start" | "center",
) {
  const viewport = resolvePlatformMainViewport(element);
  if (!viewport) {
    element.scrollIntoView({
      behavior: ASSESSMENT_NAV_SCROLL_BEHAVIOR,
      block,
    });
    return;
  }

  const viewportRect = viewport.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const offset =
    block === "center"
      ? elementRect.top -
        viewportRect.top -
        (viewportRect.height - elementRect.height) / 2
      : elementRect.top - viewportRect.top;

  const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  viewport.scrollTop = Math.max(
    0,
    Math.min(maxScroll, viewport.scrollTop + offset),
  );
}

export function scrollAssessmentTarget(
  intent: AssessmentScrollIntent,
  criterionTop: HTMLElement | null,
): void {
  if (intent.kind === "question") {
    const node = document.querySelector(
      `[data-question-id="${intent.questionId}"]`,
    ) as HTMLElement | null;
    if (node) {
      scrollWithinPlatformViewport(node, "center");
    }
    return;
  }

  if (criterionTop) {
    scrollWithinPlatformViewport(criterionTop, "start");
  }
}
