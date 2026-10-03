import "server-only";

import { isApplicationAiProviderAvailable } from "@/platform/ai/config";
import { createServerSupabaseClient } from "@/platform/supabase/server";

import { mergeLeanAiApplicationAvailability } from "./readiness";
import { validateLeanAiSemanticEventInput } from "./taxonomy";
import type {
  LeanAiContextualSnapshot,
  LeanAiJourneyContext,
  LeanAiRetentionPolicy,
  LeanAiSemanticEventInput,
  OrganisationSetupReadiness,
  SetupReadinessItem,
  SetupReadinessKey,
  SetupReadinessStatus,
} from "./types";
import {
  LEANAI_MODULE_KEYS,
  LEANAI_SEMANTIC_EVENT_KEYS,
  SETUP_READINESS_KEYS,
  SETUP_READINESS_STATUSES,
} from "./types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isSetupReadinessKey(value: string): value is SetupReadinessKey {
  return (SETUP_READINESS_KEYS as readonly string[]).includes(value);
}

function isSetupReadinessStatus(value: string): value is SetupReadinessStatus {
  return (SETUP_READINESS_STATUSES as readonly string[]).includes(value);
}

function parseItem(value: unknown): SetupReadinessItem | null {
  const record = asRecord(value);
  const key = asString(record.key);
  const status = asString(record.status);
  if (
    !key ||
    !status ||
    !isSetupReadinessKey(key) ||
    !isSetupReadinessStatus(status)
  ) {
    return null;
  }
  const prerequisites = Array.isArray(record.prerequisites)
    ? record.prerequisites.filter(
        (entry): entry is SetupReadinessKey =>
          typeof entry === "string" && isSetupReadinessKey(entry),
      )
    : [];
  const metrics = asRecord(record.supporting_metrics);
  const supportingMetrics: SetupReadinessItem["supportingMetrics"] = {};
  for (const [metricKey, metricValue] of Object.entries(metrics)) {
    if (
      typeof metricValue === "string" ||
      typeof metricValue === "number" ||
      typeof metricValue === "boolean" ||
      metricValue === null
    ) {
      supportingMetrics[metricKey] = metricValue;
    }
  }
  return {
    key,
    status,
    reason: asString(record.reason) ?? "",
    reasonCode: asString(record.reason_code) ?? "",
    prerequisites,
    recommendedAction: asString(record.recommended_action) ?? "",
    targetRoute: asString(record.target_route) ?? "",
    supportingMetrics,
  };
}

function parseReadiness(value: unknown): OrganisationSetupReadiness {
  const record = asRecord(value);
  const items = Array.isArray(record.items)
    ? record.items
        .map(parseItem)
        .filter((entry): entry is SetupReadinessItem => entry !== null)
    : [];
  return {
    organisationId: asString(record.organisation_id) ?? "",
    evaluatedAt: asString(record.evaluated_at) ?? "",
    readyCount: asNumber(record.ready_count),
    totalCount: asNumber(record.total_count) || items.length,
    items,
  };
}

function parseJourney(value: unknown): LeanAiJourneyContext {
  const record = asRecord(value);
  const recentModuleKey = asString(record.recent_module_key);
  const lastOnboardingEventKey = asString(record.last_onboarding_event_key);
  const lastInterventionEventKey = asString(record.last_intervention_event_key);
  const interventionStates = Array.isArray(record.intervention_states)
    ? record.intervention_states
        .map((entry) => {
          const state = asRecord(entry);
          const eventKey = asString(state.last_event_key);
          const interventionKey = asString(state.intervention_key);
          if (
            !interventionKey ||
            !eventKey ||
            !(LEANAI_SEMANTIC_EVENT_KEYS as readonly string[]).includes(
              eventKey,
            )
          ) {
            return null;
          }
          return {
            interventionKey,
            lastEventKey:
              eventKey as LeanAiJourneyContext["lastInterventionEventKey"] &
                string,
            lastShownAt: asString(state.last_shown_at),
            lastAcceptedAt: asString(state.last_accepted_at),
            lastDismissedAt: asString(state.last_dismissed_at),
            snoozedUntil: asString(state.snoozed_until),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : [];

  return {
    organisationId: asString(record.organisation_id) ?? "",
    membershipId: asString(record.membership_id) ?? "",
    recentModuleKey:
      recentModuleKey &&
      (LEANAI_MODULE_KEYS as readonly string[]).includes(recentModuleKey)
        ? (recentModuleKey as LeanAiJourneyContext["recentModuleKey"])
        : null,
    recentModuleOpenedAt: asString(record.recent_module_opened_at),
    onboardingStatus:
      asString(record.onboarding_status) === "completed"
        ? "completed"
        : asString(record.onboarding_status) === "in_progress"
          ? "in_progress"
          : "not_started",
    lastOnboardingStepKey: asString(record.last_onboarding_step_key),
    lastOnboardingEventKey:
      lastOnboardingEventKey &&
      (LEANAI_SEMANTIC_EVENT_KEYS as readonly string[]).includes(
        lastOnboardingEventKey,
      )
        ? (lastOnboardingEventKey as LeanAiJourneyContext["lastOnboardingEventKey"])
        : null,
    lastOnboardingAt: asString(record.last_onboarding_at),
    lastInterventionKey: asString(record.last_intervention_key),
    lastInterventionEventKey:
      lastInterventionEventKey &&
      (LEANAI_SEMANTIC_EVENT_KEYS as readonly string[]).includes(
        lastInterventionEventKey,
      )
        ? (lastInterventionEventKey as LeanAiJourneyContext["lastInterventionEventKey"])
        : null,
    lastInterventionAt: asString(record.last_intervention_at),
    interventionStates,
  };
}

function parseRetention(value: unknown): LeanAiRetentionPolicy {
  const record = asRecord(value);
  return {
    eventRetentionDays: asNumber(record.event_retention_days) || 90,
    cleanupAvailable: record.cleanup_available === true,
  };
}

export async function loadLeanAiContextualSnapshot(): Promise<LeanAiContextualSnapshot> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_leanai_contextual_snapshot");
  if (error) {
    throw error;
  }
  const record = asRecord(data);
  const applicationAiAvailable = isApplicationAiProviderAvailable();
  return {
    readiness: mergeLeanAiApplicationAvailability(
      parseReadiness(record.readiness),
      applicationAiAvailable,
    ),
    journey: parseJourney(record.journey),
    retention: parseRetention(record.retention),
    applicationAiAvailable,
    proactiveAssistanceEnabled: record.proactive_assistance_enabled !== false,
    webSearchEnabled: record.web_search_enabled === true,
  };
}

export async function recordLeanAiSemanticEvent(
  input: LeanAiSemanticEventInput,
): Promise<{ eventId: string }> {
  const errors = validateLeanAiSemanticEventInput(input);
  if (errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Invalid LeanAI semantic event.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("record_leanai_semantic_event", {
    target_event_key: input.eventKey,
    target_event_version: input.eventVersion ?? 1,
    ...(input.moduleKey ? { target_module_key: input.moduleKey } : {}),
    ...(input.interventionKey
      ? { target_intervention_key: input.interventionKey }
      : {}),
    ...(input.siteUnitId ? { target_site_unit_id: input.siteUnitId } : {}),
    target_metadata: input.metadata ?? {},
    ...(input.occurredAt ? { target_occurred_at: input.occurredAt } : {}),
  });
  if (error) {
    throw error;
  }
  return { eventId: String(data) };
}
