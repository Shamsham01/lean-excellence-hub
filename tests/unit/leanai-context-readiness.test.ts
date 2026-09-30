import { describe, expect, it } from "vitest";

import { setupReadinessCta } from "@/modules/leanai-context/cta";
import {
  assertSetupReadinessGraphAcyclic,
  SETUP_READINESS_PREREQUISITE_GRAPH,
} from "@/modules/leanai-context/prerequisite-graph";
import {
  emptyOrganisationFacts,
  evaluateSetupReadinessFromFacts,
  mergeLeanAiApplicationAvailability,
  statusByKey,
} from "@/modules/leanai-context/readiness";
import { SETUP_READINESS_KEYS } from "@/modules/leanai-context/types";

describe("LeanAI setup readiness", () => {
  it("keeps the prerequisite graph acyclic", () => {
    expect(assertSetupReadinessGraphAcyclic()).toEqual([]);
    expect(SETUP_READINESS_PREREQUISITE_GRAPH.five_s.hard).toContain("sites");
    expect(SETUP_READINESS_PREREQUISITE_GRAPH.training.soft).toContain(
      "people",
    );
  });

  it("provides static CTA metadata for every key and status", () => {
    for (const key of SETUP_READINESS_KEYS) {
      for (const status of [
        "not_started",
        "incomplete",
        "ready",
        "blocked",
      ] as const) {
        const cta = setupReadinessCta(key, status);
        expect(cta.recommendedAction.length).toBeGreaterThan(0);
        expect(cta.targetRoute.startsWith("/")).toBe(true);
      }
    }
  });

  it("marks an empty provisioned organisation with conservative module states", () => {
    const readiness = evaluateSetupReadinessFromFacts(emptyOrganisationFacts());
    const status = statusByKey(readiness);

    expect(status.organisation).toBe("ready");
    expect(status.sites).toBe("not_started");
    expect(status.people).toBe("incomplete");
    expect(status.maturity).toBe("not_started");
    expect(status.suggestions).toBe("not_started");
    expect(status.five_s).toBe("blocked");
    expect(status.gemba).toBe("blocked");
    expect(status.training).toBe("not_started");
    expect(status.skills).toBe("not_started");
    expect(status.recognition).toBe("blocked");
    expect(status.lean_ai).toBe("not_started");
    expect(
      readiness.items.find((item) => item.key === "maturity")
        ?.recommendedAction,
    ).toBe("Set up a Maturity Framework");
  });

  it("marks a partial organisation as incomplete for started modules", () => {
    const readiness = evaluateSetupReadinessFromFacts({
      ...emptyOrganisationFacts(),
      activeBillableSiteCount: 1,
      activeUnitCount: 1,
      maturityModelCount: 1,
      publishedMaturityVersionCount: 0,
      suggestionProgrammeCount: 1,
      trainingCourseCount: 1,
      fiveSStandardCount: 1,
    });
    const status = statusByKey(readiness);

    expect(status.sites).toBe("ready");
    expect(status.maturity).toBe("incomplete");
    expect(status.suggestions).toBe("incomplete");
    expect(status.training).toBe("incomplete");
    expect(status.five_s).toBe("incomplete");
    expect(status.gemba).toBe("not_started");
    expect(status.recognition).toBe("not_started");
  });

  it("marks a mature organisation ready across configured modules", () => {
    const readiness = evaluateSetupReadinessFromFacts({
      ...emptyOrganisationFacts(),
      activeBillableSiteCount: 2,
      activeUnitCount: 3,
      activeJobFunctionCount: 2,
      maturityModelCount: 1,
      publishedMaturityVersionCount: 1,
      suggestionProgrammeCount: 1,
      activePublishedSuggestionProgrammeCount: 1,
      fiveSStandardCount: 1,
      publishedApplicableFiveSCount: 1,
      gembaDefinitionCount: 1,
      publishedApplicableGembaCount: 1,
      trainingCourseCount: 2,
      publishedTrainingCourseCount: 1,
      publishedTrainingCurriculumWithRequirementCount: 1,
      skillScaleCount: 1,
      skillCount: 1,
      skillCapabilitySetCount: 1,
      publishedSkillScaleWithLevelCount: 1,
      activeSkillCount: 1,
      publishedSkillCapabilitySetWithRequirementCount: 1,
      recognitionTypeCount: 1,
      activeRecognitionTypeCount: 1,
      leanAiOrganisationEnabled: true,
      leanAiCurrentUserCanUse: true,
    });
    const status = statusByKey(readiness);

    for (const key of SETUP_READINESS_KEYS) {
      expect(status[key]).toBe("ready");
    }
    expect(readiness.readyCount).toBe(11);
  });

  it("keeps LeanAI incomplete when the application provider is disabled", () => {
    const readiness = mergeLeanAiApplicationAvailability(
      evaluateSetupReadinessFromFacts({
        ...emptyOrganisationFacts(),
        leanAiOrganisationEnabled: true,
        leanAiCurrentUserCanUse: true,
      }),
      false,
    );
    const leanAi = readiness.items.find((item) => item.key === "lean_ai");
    expect(leanAi?.status).toBe("incomplete");
    expect(leanAi?.reasonCode).toBe("lean_ai_application_unavailable");
    expect(leanAi?.supportingMetrics.application_available).toBe(false);
  });
});
