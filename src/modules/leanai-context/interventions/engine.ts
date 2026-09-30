import { statusByKey } from "../readiness";
import type { LeanAiInterventionState } from "../types";

import { LEANAI_INTERVENTION_CATALOGUE } from "./catalogue";
import type {
  LeanAiInterventionCandidate,
  LeanAiInterventionDefinition,
  LeanAiInterventionSelectionInput,
} from "./types";

const DEFAULT_LIMIT = 1;

function hasRequiredPermissions(
  definition: LeanAiInterventionDefinition,
  permissions: Record<string, boolean>,
): boolean {
  return definition.requiredPermissions.every(
    (permissionKey) => permissions[permissionKey] === true,
  );
}

function isSnoozed(
  state: LeanAiInterventionState | undefined,
  now: Date,
): boolean {
  if (!state?.snoozedUntil) {
    return false;
  }
  const until = Date.parse(state.snoozedUntil);
  return Number.isFinite(until) && until > now.getTime();
}

function isDismissed(
  definition: LeanAiInterventionDefinition,
  state: LeanAiInterventionState | undefined,
  now: Date,
): boolean {
  if (!state?.lastDismissedAt) {
    return false;
  }
  const dismissedAt = Date.parse(state.lastDismissedAt);
  if (!Number.isFinite(dismissedAt)) {
    return false;
  }
  const cooldownMs = definition.dismissCooldownHours * 60 * 60 * 1000;
  return dismissedAt + cooldownMs > now.getTime();
}

function toCandidate(
  definition: LeanAiInterventionDefinition,
  organisationId: string,
  status: LeanAiInterventionCandidate["status"],
): LeanAiInterventionCandidate {
  return {
    key: definition.key,
    moduleKey: definition.moduleKey,
    readinessKey: definition.readinessKey,
    status,
    priority: definition.priority,
    title: definition.title,
    body: definition.body,
    explain: definition.explain,
    primaryCtaLabel: definition.primaryCtaLabel,
    targetRoute: definition.targetRoute,
    snoozeMinutes: definition.snoozeMinutes,
    organisationId,
  };
}

/**
 * Deterministic intervention engine. Zero model calls. Uses the existing
 * readiness snapshot, current-user permission map, and compact intervention
 * current-state. Does not rank employee behaviour.
 */
export function selectLeanAiInterventions(
  input: LeanAiInterventionSelectionInput,
): LeanAiInterventionCandidate[] {
  if (!input.snapshot.proactiveAssistanceEnabled) {
    return [];
  }

  const now = input.now ?? new Date();
  const limit = input.limit ?? DEFAULT_LIMIT;
  const status = statusByKey(input.snapshot.readiness);
  const stateByKey = new Map(
    input.snapshot.journey.interventionStates.map((state) => [
      state.interventionKey,
      state,
    ]),
  );

  const ranked = LEANAI_INTERVENTION_CATALOGUE.filter((definition) => {
    if (!definition.surfaces.includes(input.surface)) {
      return false;
    }
    const readinessStatus = status[definition.readinessKey];
    if (!definition.eligibleStatuses.includes(readinessStatus)) {
      return false;
    }
    if (readinessStatus === "ready") {
      return false;
    }
    if (!hasRequiredPermissions(definition, input.permissions)) {
      return false;
    }
    const state = stateByKey.get(definition.key);
    if (isSnoozed(state, now) || isDismissed(definition, state, now)) {
      return false;
    }
    return true;
  })
    .sort((left, right) => left.priority - right.priority)
    .slice(0, Math.max(1, limit))
    .map((definition) =>
      toCandidate(
        definition,
        input.snapshot.readiness.organisationId,
        status[definition.readinessKey],
      ),
    );

  return ranked;
}

export function selectPrimaryLeanAiIntervention(
  input: LeanAiInterventionSelectionInput,
): LeanAiInterventionCandidate | null {
  return selectLeanAiInterventions({ ...input, limit: 1 })[0] ?? null;
}
