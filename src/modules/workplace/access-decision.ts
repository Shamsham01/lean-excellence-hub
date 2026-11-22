export type WorkplaceAccessDecision =
  "module" | "workplace" | "restricted" | "denied";

/**
 * Chooses the rendered experience from three separate facts:
 * an explicit module grant, a Workplace Viewer grant, and baseline
 * participation. Baseline participation is not catalogue authority.
 */
export function decideWorkplaceAccess(input: {
  hasExplicitModuleRead: boolean;
  hasWorkplaceView: boolean;
  hasBaselineParticipation: boolean;
  baselineOpensModule?: boolean;
}): WorkplaceAccessDecision {
  if (input.hasExplicitModuleRead) return "module";
  if (input.hasWorkplaceView) return "workplace";
  if (input.hasBaselineParticipation && input.baselineOpensModule) {
    return "module";
  }
  if (input.hasBaselineParticipation) return "restricted";
  return "denied";
}

export type CatalogReadPresentation = "failed" | "empty" | "ready";

export function presentCatalogRead(input: {
  failed: boolean;
  visibleCount: number;
}): CatalogReadPresentation {
  if (input.failed) return "failed";
  if (input.visibleCount <= 0) return "empty";
  return "ready";
}
