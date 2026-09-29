import type { SetupReadinessKey } from "./types";

/**
 * Explainable setup-order graph for LeanAI. Hard prerequisites can block
 * not_started items; soft prerequisites are recommended order only.
 */
export const SETUP_READINESS_PREREQUISITE_GRAPH: Record<
  SetupReadinessKey,
  { hard: SetupReadinessKey[]; soft: SetupReadinessKey[] }
> = {
  organisation: { hard: [], soft: [] },
  sites: { hard: ["organisation"], soft: [] },
  people: { hard: ["organisation"], soft: [] },
  maturity: { hard: ["organisation"], soft: ["sites"] },
  suggestions: { hard: ["organisation"], soft: ["sites"] },
  five_s: { hard: ["sites"], soft: ["organisation"] },
  gemba: { hard: ["sites"], soft: ["organisation"] },
  training: { hard: ["organisation"], soft: ["people"] },
  skills: { hard: ["organisation"], soft: ["people"] },
  recognition: { hard: ["sites"], soft: ["organisation"] },
  lean_ai: { hard: ["organisation"], soft: [] },
};

export function setupReadinessPrerequisiteKeys(
  key: SetupReadinessKey,
): SetupReadinessKey[] {
  const edge = SETUP_READINESS_PREREQUISITE_GRAPH[key];
  return [...new Set([...edge.hard, ...edge.soft])];
}

export function assertSetupReadinessGraphAcyclic(): SetupReadinessKey[] {
  const visiting = new Set<SetupReadinessKey>();
  const visited = new Set<SetupReadinessKey>();
  const cycle: SetupReadinessKey[] = [];

  function walk(node: SetupReadinessKey): boolean {
    if (visiting.has(node)) {
      cycle.push(node);
      return true;
    }
    if (visited.has(node)) {
      return false;
    }
    visiting.add(node);
    for (const next of setupReadinessPrerequisiteKeys(node)) {
      if (walk(next)) {
        cycle.push(node);
        return true;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const key of Object.keys(
    SETUP_READINESS_PREREQUISITE_GRAPH,
  ) as SetupReadinessKey[]) {
    if (walk(key)) {
      return cycle.reverse();
    }
  }
  return [];
}
