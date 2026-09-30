import { describe, expect, it } from "vitest";

import {
  LEANAI_INTERVENTION_CATALOGUE,
  LEANAI_INTERVENTION_PERMISSION_KEYS,
} from "@/modules/leanai-context/interventions/catalogue";
import {
  selectLeanAiInterventions,
  selectPrimaryLeanAiIntervention,
} from "@/modules/leanai-context/interventions/engine";
import type { LeanAiInterventionSelectionInput } from "@/modules/leanai-context/interventions/types";
import {
  emptyOrganisationFacts,
  evaluateSetupReadinessFromFacts,
} from "@/modules/leanai-context/readiness";
import type {
  LeanAiContextualSnapshot,
  LeanAiInterventionState,
  SetupReadinessFacts,
} from "@/modules/leanai-context/types";

function allPermissions(enabled = true): Record<string, boolean> {
  return Object.fromEntries(
    LEANAI_INTERVENTION_PERMISSION_KEYS.map((key) => [key, enabled]),
  );
}

function snapshotFromFacts(
  facts: SetupReadinessFacts,
  options: {
    interventionStates?: LeanAiInterventionState[];
    proactiveAssistanceEnabled?: boolean;
    applicationAiAvailable?: boolean;
    organisationId?: string;
  } = {},
): LeanAiContextualSnapshot {
  const organisationId = options.organisationId ?? "org-a";
  return {
    readiness: evaluateSetupReadinessFromFacts(facts, organisationId),
    journey: {
      organisationId,
      membershipId: "membership-a",
      recentModuleKey: null,
      recentModuleOpenedAt: null,
      onboardingStatus: "not_started",
      lastOnboardingStepKey: null,
      lastOnboardingEventKey: null,
      lastOnboardingAt: null,
      lastInterventionKey: null,
      lastInterventionAt: null,
      lastInterventionEventKey: null,
      interventionStates: options.interventionStates ?? [],
    },
    retention: { eventRetentionDays: 90, cleanupAvailable: true },
    applicationAiAvailable: options.applicationAiAvailable ?? false,
    proactiveAssistanceEnabled: options.proactiveAssistanceEnabled ?? true,
  };
}

function select(
  overrides: Partial<LeanAiInterventionSelectionInput> & {
    facts?: SetupReadinessFacts;
  } = {},
) {
  const { facts, snapshot, ...rest } = overrides;
  return selectLeanAiInterventions({
    snapshot: snapshot ?? snapshotFromFacts(facts ?? emptyOrganisationFacts()),
    permissions: allPermissions(),
    surface: "platform_home",
    limit: 5,
    ...rest,
  });
}

describe("LeanAI intervention catalogue", () => {
  it("covers every high-value setup gap with a stable key and permissions", () => {
    const keys = LEANAI_INTERVENTION_CATALOGUE.map((entry) => entry.key);
    expect(keys).toEqual([
      "organisation_profile_setup",
      "sites_first_setup",
      "people_job_functions_setup",
      "maturity_first_setup",
      "suggestions_programme_setup",
      "five_s_standard_setup",
      "gemba_definition_setup",
      "training_curriculum_setup",
      "skills_capability_setup",
      "recognition_types_setup",
      "lean_ai_enablement_setup",
    ]);
    for (const entry of LEANAI_INTERVENTION_CATALOGUE) {
      expect(entry.requiredPermissions.length).toBeGreaterThan(0);
      expect(entry.explain.length).toBeGreaterThan(20);
      expect(entry.targetRoute.startsWith("/")).toBe(true);
      expect(entry.snoozeMinutes).toBe(1_440);
    }
  });
});

describe("LeanAI intervention engine", () => {
  it("recommends the first site on a fresh organisation", () => {
    const primary = selectPrimaryLeanAiIntervention({
      snapshot: snapshotFromFacts(emptyOrganisationFacts()),
      permissions: allPermissions(),
      surface: "platform_home",
    });
    expect(primary?.key).toBe("sites_first_setup");
    expect(primary?.targetRoute).toBe("/platform/settings/structure");
  });

  it("does not recommend a module that is already ready", () => {
    const candidates = select({
      facts: {
        ...emptyOrganisationFacts(),
        activeBillableSiteCount: 1,
        activeUnitCount: 1,
      },
    });
    expect(candidates.some((entry) => entry.key === "sites_first_setup")).toBe(
      false,
    );
    expect(candidates[0]?.key).toBe("people_job_functions_setup");
  });

  it("hides CTAs the current user cannot perform", () => {
    const candidates = select({
      permissions: {
        ...allPermissions(),
        "hierarchy.manage": false,
      },
    });
    expect(candidates.some((entry) => entry.key === "sites_first_setup")).toBe(
      false,
    );
    expect(candidates[0]?.key).toBe("people_job_functions_setup");
  });

  it("returns no actionable coach when the user lacks every setup permission", () => {
    const candidates = select({ permissions: allPermissions(false) });
    expect(candidates).toEqual([]);
  });

  it("does not show 5S while it is blocked on sites", () => {
    const candidates = select();
    expect(
      candidates.some((entry) => entry.key === "five_s_standard_setup"),
    ).toBe(false);
  });

  it("keeps dismissal until the cooldown expires", () => {
    const now = new Date("2026-09-30T12:00:00.000Z");
    const dismissed = select({
      now,
      snapshot: snapshotFromFacts(emptyOrganisationFacts(), {
        interventionStates: [
          {
            interventionKey: "sites_first_setup",
            lastEventKey: "leanai.intervention_dismissed",
            lastShownAt: "2026-09-30T11:00:00.000Z",
            lastAcceptedAt: null,
            lastDismissedAt: "2026-09-30T11:00:00.000Z",
            snoozedUntil: null,
          },
        ],
      }),
    });
    expect(dismissed[0]?.key).not.toBe("sites_first_setup");

    const afterCooldown = select({
      now: new Date("2026-10-08T12:00:00.000Z"),
      snapshot: snapshotFromFacts(emptyOrganisationFacts(), {
        interventionStates: [
          {
            interventionKey: "sites_first_setup",
            lastEventKey: "leanai.intervention_dismissed",
            lastShownAt: "2026-09-30T11:00:00.000Z",
            lastAcceptedAt: null,
            lastDismissedAt: "2026-09-30T11:00:00.000Z",
            snoozedUntil: null,
          },
        ],
      }),
    });
    expect(afterCooldown[0]?.key).toBe("sites_first_setup");
  });

  it("hides a snoozed intervention until snoozed_until and restores it after", () => {
    const snoozed = select({
      now: new Date("2026-09-30T12:00:00.000Z"),
      snapshot: snapshotFromFacts(emptyOrganisationFacts(), {
        interventionStates: [
          {
            interventionKey: "sites_first_setup",
            lastEventKey: "leanai.intervention_snoozed",
            lastShownAt: "2026-09-30T10:00:00.000Z",
            lastAcceptedAt: null,
            lastDismissedAt: null,
            snoozedUntil: "2026-09-30T13:00:00.000Z",
          },
        ],
      }),
    });
    expect(snoozed[0]?.key).not.toBe("sites_first_setup");

    const expired = select({
      now: new Date("2026-09-30T13:01:00.000Z"),
      snapshot: snapshotFromFacts(emptyOrganisationFacts(), {
        interventionStates: [
          {
            interventionKey: "sites_first_setup",
            lastEventKey: "leanai.intervention_snoozed",
            lastShownAt: "2026-09-30T10:00:00.000Z",
            lastAcceptedAt: null,
            lastDismissedAt: null,
            snoozedUntil: "2026-09-30T13:00:00.000Z",
          },
        ],
      }),
    });
    expect(expired[0]?.key).toBe("sites_first_setup");
  });

  it("scopes maturity empty-state to maturity only", () => {
    const home = select({ surface: "platform_home" });
    const maturity = select({ surface: "maturity" });
    expect(home[0]?.key).toBe("sites_first_setup");
    expect(maturity[0]?.key).toBe("maturity_first_setup");
  });

  it("does not leak recommendations across organisations", () => {
    const orgA = select({
      snapshot: snapshotFromFacts(emptyOrganisationFacts(), {
        organisationId: "org-a",
      }),
    });
    const orgB = select({
      snapshot: snapshotFromFacts(
        {
          ...emptyOrganisationFacts(),
          activeBillableSiteCount: 1,
          activeUnitCount: 1,
          activeJobFunctionCount: 1,
        },
        { organisationId: "org-b" },
      ),
    });
    expect(orgA[0]?.organisationId).toBe("org-a");
    expect(orgB[0]?.organisationId).toBe("org-b");
    expect(orgA[0]?.key).toBe("sites_first_setup");
    expect(orgB[0]?.key).toBe("maturity_first_setup");
  });

  it("still ranks setup gaps when the application AI provider is disabled", () => {
    const candidates = select({
      snapshot: snapshotFromFacts(emptyOrganisationFacts(), {
        applicationAiAvailable: false,
      }),
      limit: 11,
    });
    expect(candidates[0]?.key).toBe("sites_first_setup");
    expect(
      candidates.some((entry) => entry.key === "lean_ai_enablement_setup"),
    ).toBe(true);
  });

  it("returns nothing when proactive assistance is disabled", () => {
    const candidates = select({
      snapshot: snapshotFromFacts(emptyOrganisationFacts(), {
        proactiveAssistanceEnabled: false,
      }),
    });
    expect(candidates).toEqual([]);
  });
});
