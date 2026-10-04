import { setupReadinessCta } from "./cta";
import {
  SETUP_READINESS_PREREQUISITE_GRAPH,
  setupReadinessPrerequisiteKeys,
} from "./prerequisite-graph";
import type {
  OrganisationSetupReadiness,
  SetupReadinessFacts,
  SetupReadinessItem,
  SetupReadinessKey,
  SetupReadinessStatus,
} from "./types";
import { SETUP_READINESS_KEYS } from "./types";

function item(
  key: SetupReadinessKey,
  status: SetupReadinessStatus,
  reason: string,
  reasonCode: string,
  supportingMetrics: SetupReadinessItem["supportingMetrics"],
): SetupReadinessItem {
  const cta = setupReadinessCta(key, status);
  return {
    key,
    status,
    reason,
    reasonCode,
    prerequisites: setupReadinessPrerequisiteKeys(key),
    recommendedAction: cta.recommendedAction,
    targetRoute: cta.targetRoute,
    supportingMetrics,
  };
}

function evaluateOrganisation(facts: SetupReadinessFacts): SetupReadinessItem {
  if (!facts.organisationOperational) {
    return item(
      "organisation",
      "blocked",
      "Organisation access is suspended or closed.",
      "organisation_not_operational",
      {
        organisation_status: facts.organisationStatus,
        onboarding_required: facts.onboardingRequired,
      },
    );
  }
  if (!facts.organisationName) {
    return item(
      "organisation",
      "not_started",
      "Organisation profile has not been created.",
      "organisation_missing",
      { organisation_status: facts.organisationStatus },
    );
  }
  if (facts.organisationStatus !== "active" || facts.onboardingRequired) {
    return item(
      "organisation",
      "incomplete",
      "Organisation profile or onboarding is still incomplete.",
      "organisation_onboarding_incomplete",
      {
        organisation_status: facts.organisationStatus,
        onboarding_required: facts.onboardingRequired,
      },
    );
  }
  return item(
    "organisation",
    "ready",
    "Organisation profile is active.",
    "organisation_active",
    {
      organisation_status: facts.organisationStatus,
      onboarding_required: facts.onboardingRequired,
    },
  );
}

function evaluateSites(facts: SetupReadinessFacts): SetupReadinessItem {
  const metrics = {
    active_billable_site_count: facts.activeBillableSiteCount,
    active_unit_count: facts.activeUnitCount,
  };
  if (facts.activeBillableSiteCount >= 1) {
    return item(
      "sites",
      "ready",
      "At least one active site exists.",
      "sites_ready",
      metrics,
    );
  }
  if (facts.activeUnitCount >= 1) {
    return item(
      "sites",
      "incomplete",
      "Units exist but none are active billable sites.",
      "sites_no_billable_site",
      metrics,
    );
  }
  return item(
    "sites",
    "not_started",
    "No active site has been created.",
    "sites_none",
    metrics,
  );
}

function evaluatePeople(facts: SetupReadinessFacts): SetupReadinessItem {
  const metrics = {
    has_active_owner: facts.hasActiveOwner,
    active_job_function_count: facts.activeJobFunctionCount,
  };
  if (!facts.hasActiveOwner) {
    return item(
      "people",
      "not_started",
      "No active organisation owner is assigned.",
      "people_no_owner",
      metrics,
    );
  }
  if (facts.activeJobFunctionCount < 1) {
    return item(
      "people",
      "incomplete",
      "An owner exists, but job functions have not been configured.",
      "people_no_job_functions",
      metrics,
    );
  }
  return item(
    "people",
    "ready",
    "An organisation owner and at least one job function exist.",
    "people_ready",
    metrics,
  );
}

function evaluateMaturity(facts: SetupReadinessFacts): SetupReadinessItem {
  const metrics = {
    model_count: facts.maturityModelCount,
    published_version_count: facts.publishedMaturityVersionCount,
  };
  if (facts.publishedMaturityVersionCount >= 1) {
    return item(
      "maturity",
      "ready",
      "A published Maturity Framework exists.",
      "maturity_published",
      metrics,
    );
  }
  if (facts.maturityModelCount >= 1) {
    return item(
      "maturity",
      "incomplete",
      "A Maturity Framework exists but is not published.",
      "maturity_draft_only",
      metrics,
    );
  }
  return item(
    "maturity",
    "not_started",
    "No Maturity Framework exists yet. You can start manually or deploy the LEH Operational Excellence Standard as a draft.",
    "maturity_none",
    metrics,
  );
}

function evaluateSuggestions(facts: SetupReadinessFacts): SetupReadinessItem {
  const metrics = {
    programme_count: facts.suggestionProgrammeCount,
    active_published_programme_count:
      facts.activePublishedSuggestionProgrammeCount,
  };
  if (facts.activePublishedSuggestionProgrammeCount >= 1) {
    return item(
      "suggestions",
      "ready",
      "An active published Suggestion Programme exists.",
      "suggestions_published",
      metrics,
    );
  }
  if (facts.suggestionProgrammeCount >= 1) {
    return item(
      "suggestions",
      "incomplete",
      "A Suggestion Programme exists but is not active and published.",
      "suggestions_unpublished",
      metrics,
    );
  }
  return item(
    "suggestions",
    "not_started",
    "No Suggestion Programme exists yet.",
    "suggestions_none",
    metrics,
  );
}

function evaluateFiveS(facts: SetupReadinessFacts): SetupReadinessItem {
  const metrics = {
    standard_count: facts.fiveSStandardCount,
    published_applicable_count: facts.publishedApplicableFiveSCount,
  };
  if (facts.publishedApplicableFiveSCount >= 1) {
    return item(
      "five_s",
      "ready",
      "A published 5S standard applies to an active unit.",
      "five_s_published",
      metrics,
    );
  }
  if (facts.fiveSStandardCount >= 1) {
    return item(
      "five_s",
      "incomplete",
      "A 5S standard exists but is not published with active applicability.",
      "five_s_unpublished",
      metrics,
    );
  }
  return item(
    "five_s",
    "not_started",
    "No 5S standard exists yet.",
    "five_s_none",
    metrics,
  );
}

function evaluateGemba(facts: SetupReadinessFacts): SetupReadinessItem {
  const metrics = {
    definition_count: facts.gembaDefinitionCount,
    published_applicable_count: facts.publishedApplicableGembaCount,
  };
  if (facts.publishedApplicableGembaCount >= 1) {
    return item(
      "gemba",
      "ready",
      "A published Gemba definition applies to an active unit.",
      "gemba_published",
      metrics,
    );
  }
  if (facts.gembaDefinitionCount >= 1) {
    return item(
      "gemba",
      "incomplete",
      "A Gemba definition exists but is not published with active applicability.",
      "gemba_unpublished",
      metrics,
    );
  }
  return item(
    "gemba",
    "not_started",
    "No Gemba definition exists yet.",
    "gemba_none",
    metrics,
  );
}

function evaluateTraining(facts: SetupReadinessFacts): SetupReadinessItem {
  const metrics = {
    course_count: facts.trainingCourseCount,
    published_course_count: facts.publishedTrainingCourseCount,
    published_curriculum_with_requirement_count:
      facts.publishedTrainingCurriculumWithRequirementCount,
  };
  if (
    facts.publishedTrainingCourseCount >= 1 &&
    facts.publishedTrainingCurriculumWithRequirementCount >= 1
  ) {
    return item(
      "training",
      "ready",
      "A published course and a published curriculum requirement exist.",
      "training_ready",
      metrics,
    );
  }
  if (
    facts.trainingCourseCount >= 1 ||
    facts.publishedTrainingCourseCount >= 1
  ) {
    return item(
      "training",
      "incomplete",
      "Training catalogue work has started, but a published curriculum requirement is missing.",
      "training_catalogue_only",
      metrics,
    );
  }
  return item(
    "training",
    "not_started",
    "No training catalogue exists yet.",
    "training_none",
    metrics,
  );
}

function evaluateSkills(facts: SetupReadinessFacts): SetupReadinessItem {
  const metrics = {
    scale_count: facts.skillScaleCount,
    skill_count: facts.skillCount,
    capability_set_count: facts.skillCapabilitySetCount,
    published_scale_with_level_count: facts.publishedSkillScaleWithLevelCount,
    active_skill_count: facts.activeSkillCount,
    published_capability_set_with_requirement_count:
      facts.publishedSkillCapabilitySetWithRequirementCount,
  };
  if (
    facts.publishedSkillScaleWithLevelCount >= 1 &&
    facts.activeSkillCount >= 1 &&
    facts.publishedSkillCapabilitySetWithRequirementCount >= 1
  ) {
    return item(
      "skills",
      "ready",
      "A published scale, an active skill, and a published capability requirement exist.",
      "skills_ready",
      metrics,
    );
  }
  if (
    facts.skillScaleCount >= 1 ||
    facts.skillCount >= 1 ||
    facts.skillCapabilitySetCount >= 1
  ) {
    return item(
      "skills",
      "incomplete",
      "Skills configuration has started but is not yet a usable published set.",
      "skills_partial",
      metrics,
    );
  }
  return item(
    "skills",
    "not_started",
    "No Skills configuration exists yet.",
    "skills_none",
    metrics,
  );
}

function evaluateRecognition(facts: SetupReadinessFacts): SetupReadinessItem {
  const metrics = {
    type_count: facts.recognitionTypeCount,
    active_type_count: facts.activeRecognitionTypeCount,
  };
  if (facts.activeRecognitionTypeCount >= 1) {
    return item(
      "recognition",
      "ready",
      "At least one active recognition type exists.",
      "recognition_ready",
      metrics,
    );
  }
  if (facts.recognitionTypeCount >= 1) {
    return item(
      "recognition",
      "incomplete",
      "Recognition types exist but none are active.",
      "recognition_inactive",
      metrics,
    );
  }
  return item(
    "recognition",
    "not_started",
    "No recognition type exists yet.",
    "recognition_none",
    metrics,
  );
}

function evaluateLeanAi(facts: SetupReadinessFacts): SetupReadinessItem {
  const metrics = {
    organisation_enabled: facts.leanAiOrganisationEnabled,
    current_user_can_use: facts.leanAiCurrentUserCanUse,
  };
  if (!facts.leanAiOrganisationEnabled) {
    return item(
      "lean_ai",
      "not_started",
      "LeanAI is not enabled for this organisation.",
      "lean_ai_disabled",
      metrics,
    );
  }
  if (!facts.leanAiCurrentUserCanUse) {
    return item(
      "lean_ai",
      "incomplete",
      "LeanAI is enabled, but the current user cannot use it.",
      "lean_ai_no_permission",
      metrics,
    );
  }
  return item(
    "lean_ai",
    "ready",
    "LeanAI is enabled for this organisation and the current user may use it.",
    "lean_ai_org_ready",
    metrics,
  );
}

const EVALUATORS: Record<
  SetupReadinessKey,
  (facts: SetupReadinessFacts) => SetupReadinessItem
> = {
  organisation: evaluateOrganisation,
  sites: evaluateSites,
  people: evaluatePeople,
  maturity: evaluateMaturity,
  suggestions: evaluateSuggestions,
  five_s: evaluateFiveS,
  gemba: evaluateGemba,
  training: evaluateTraining,
  skills: evaluateSkills,
  recognition: evaluateRecognition,
  lean_ai: evaluateLeanAi,
};

export function applySetupReadinessPrerequisites(
  items: SetupReadinessItem[],
): SetupReadinessItem[] {
  const byKey = new Map(items.map((entry) => [entry.key, entry]));

  return items.map((entry) => {
    if (
      entry.status === "ready" ||
      entry.status === "incomplete" ||
      entry.status === "blocked"
    ) {
      return entry;
    }
    const hard = SETUP_READINESS_PREREQUISITE_GRAPH[entry.key].hard;
    const blocking = hard.find((key) => byKey.get(key)?.status !== "ready");
    if (!blocking) {
      return entry;
    }
    const blocked = item(
      entry.key,
      "blocked",
      `This capability is waiting on ${blocking} setup.`,
      `blocked_by_${blocking}`,
      entry.supportingMetrics,
    );
    return {
      ...blocked,
      prerequisites: entry.prerequisites,
    };
  });
}

export function evaluateSetupReadinessFromFacts(
  facts: SetupReadinessFacts,
  organisationId = "test-organisation",
  evaluatedAt = "2026-09-29T00:00:00.000Z",
): OrganisationSetupReadiness {
  const raw = SETUP_READINESS_KEYS.map((key) => EVALUATORS[key](facts));
  const items = applySetupReadinessPrerequisites(raw);
  return {
    organisationId,
    evaluatedAt,
    readyCount: items.filter((entry) => entry.status === "ready").length,
    totalCount: items.length,
    items,
  };
}

export function mergeLeanAiApplicationAvailability(
  readiness: OrganisationSetupReadiness,
  applicationAiAvailable: boolean,
): OrganisationSetupReadiness {
  const items = readiness.items.map((entry) => {
    if (entry.key !== "lean_ai") {
      return entry;
    }
    const supportingMetrics = {
      ...entry.supportingMetrics,
      application_available: applicationAiAvailable,
    };
    if (entry.status === "blocked" || entry.status === "not_started") {
      return { ...entry, supportingMetrics };
    }
    if (!applicationAiAvailable) {
      const cta = setupReadinessCta("lean_ai", "incomplete");
      return {
        ...entry,
        status: "incomplete" as const,
        reason:
          "LeanAI is enabled for the organisation, but the application provider is unavailable.",
        reasonCode: "lean_ai_application_unavailable",
        recommendedAction: cta.recommendedAction,
        targetRoute: cta.targetRoute,
        supportingMetrics,
      };
    }
    return { ...entry, supportingMetrics };
  });

  return {
    ...readiness,
    items,
    readyCount: items.filter((entry) => entry.status === "ready").length,
  };
}

export function emptyOrganisationFacts(): SetupReadinessFacts {
  return {
    organisationOperational: true,
    organisationStatus: "active",
    organisationName: "New Organisation",
    onboardingRequired: false,
    activeBillableSiteCount: 0,
    activeUnitCount: 0,
    hasActiveOwner: true,
    activeJobFunctionCount: 0,
    maturityModelCount: 0,
    publishedMaturityVersionCount: 0,
    suggestionProgrammeCount: 0,
    activePublishedSuggestionProgrammeCount: 0,
    fiveSStandardCount: 0,
    publishedApplicableFiveSCount: 0,
    gembaDefinitionCount: 0,
    publishedApplicableGembaCount: 0,
    trainingCourseCount: 0,
    publishedTrainingCourseCount: 0,
    publishedTrainingCurriculumWithRequirementCount: 0,
    skillScaleCount: 0,
    skillCount: 0,
    skillCapabilitySetCount: 0,
    publishedSkillScaleWithLevelCount: 0,
    activeSkillCount: 0,
    publishedSkillCapabilitySetWithRequirementCount: 0,
    recognitionTypeCount: 0,
    activeRecognitionTypeCount: 0,
    leanAiOrganisationEnabled: false,
    leanAiCurrentUserCanUse: true,
  };
}

export function statusByKey(
  readiness: OrganisationSetupReadiness,
): Record<SetupReadinessKey, SetupReadinessStatus> {
  return Object.fromEntries(
    readiness.items.map((entry) => [entry.key, entry.status]),
  ) as Record<SetupReadinessKey, SetupReadinessStatus>;
}
