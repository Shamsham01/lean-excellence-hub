import type { StructureGuidance } from "./types";

export type StructureGuidanceInput = {
  unitNames: readonly string[];
  jobFunctionNames: readonly string[];
  childUnitCount: number;
  activeJobFunctionCount: number;
  activeMembershipCount: number;
  pendingInvitationCount: number;
};

const QUALITY_PATTERN = /\bquality\b/i;
const PRODUCTION_PATTERN = /\bproduction\b/i;
const ENGINEERING_PATTERN = /\bengineering\b/i;
const OPERATOR_PATTERN = /\boperator\b/i;
const TEAM_LEADER_PATTERN = /\bteam leader\b/i;

function hasName(names: readonly string[], pattern: RegExp) {
  return names.some((name) => pattern.test(name));
}

export function buildStructureFirstGuidance(
  input: StructureGuidanceInput,
): StructureGuidance[] {
  const guidance: StructureGuidance[] = [];

  if (
    hasName(input.unitNames, PRODUCTION_PATTERN) &&
    hasName(input.unitNames, ENGINEERING_PATTERN) &&
    !hasName(input.unitNames, QUALITY_PATTERN)
  ) {
    guidance.push({
      id: "quality-unit-optional",
      body: "You have created Production and Engineering but no Quality function yet. Add one only if that reflects your organisation.",
    });
  }

  if (
    hasName(input.jobFunctionNames, TEAM_LEADER_PATTERN) &&
    !hasName(input.jobFunctionNames, OPERATOR_PATTERN)
  ) {
    guidance.push({
      id: "operator-function-optional",
      body: "You have defined Team Leaders but no Operator job function. Would adding one better represent your workforce?",
    });
  }

  if (input.childUnitCount === 0) {
    guidance.push({
      id: "structure-start",
      body: "Start with the units people would recognise on a Gemba walk. LEH will not prescribe a Lean operating model for you.",
    });
  }

  if (input.activeJobFunctionCount === 0) {
    guidance.push({
      id: "job-functions-start",
      body: "Job functions describe what somebody does. Access roles remain separate — they describe what somebody is allowed to do.",
    });
  }

  if (input.activeMembershipCount <= 1 && input.pendingInvitationCount === 0) {
    guidance.push({
      id: "people-optional",
      body: "You can skip inviting people for now. Adding colleagues later helps LeanAI and Operational Excellence setup use real owners and teams.",
    });
  }

  return guidance;
}
