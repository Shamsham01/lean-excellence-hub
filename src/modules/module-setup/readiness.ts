export type ModuleSetupReadiness = {
  existingCount: number;
  hasConfiguration: boolean;
  entry: "first" | "additional";
};

export function moduleSetupReadiness(
  existingCount: number,
): ModuleSetupReadiness {
  const count = Number.isFinite(existingCount)
    ? Math.max(0, Math.floor(existingCount))
    : 0;
  return {
    existingCount: count,
    hasConfiguration: count > 0,
    entry: count > 0 ? "additional" : "first",
  };
}
