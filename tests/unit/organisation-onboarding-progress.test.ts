import { describe, expect, it } from "vitest";

import {
  buildStructureFirstProgress,
  evaluateJobFunctionsStep,
  evaluatePeopleStep,
  evaluateStructureStep,
  isSkippableStructureFirstStep,
  resolveVisibleStructureFirstStep,
  structureFirstStatusLabel,
} from "@/modules/organisation-onboarding/progress";
import type { StructureFirstFacts } from "@/modules/organisation-onboarding/types";

function facts(
  overrides: Partial<StructureFirstFacts> = {},
): StructureFirstFacts {
  return {
    organisationName: "Acme Foods Ltd",
    organisationStatus: "active",
    organisationLocale: "en-GB",
    organisationTimeZone: "Europe/London",
    reportingCurrency: "GBP",
    billingPlanCode: "professional",
    billingPlanName: "Professional",
    firstSiteName: "Plymouth Factory",
    firstSiteId: "site-1",
    activeUnitCount: 1,
    childUnitCount: 0,
    activeJobFunctionCount: 0,
    activeMembershipCount: 1,
    pendingInvitationCount: 0,
    ownerDisplayName: "Przemyslaw Rzasa",
    onboardingJourneyStarted: false,
    events: [],
    ...overrides,
  };
}

describe("structure-first onboarding progress", () => {
  it("reuses organisation and first site from persisted founding data", () => {
    const progress = buildStructureFirstProgress(facts());
    expect(
      progress.steps.find((step) => step.key === "organisation")?.status,
    ).toBe("complete");
    expect(progress.steps.find((step) => step.key === "site")?.status).toBe(
      "complete",
    );
  });

  it("does not mark structure complete just because the first site exists", () => {
    expect(evaluateStructureStep(facts())).toBe("not_started");
  });

  it("marks structure complete from child units, not from visiting the step", () => {
    expect(
      evaluateStructureStep(facts({ childUnitCount: 6, activeUnitCount: 7 })),
    ).toBe("complete");
  });

  it("marks structure complete after an explicit start-simple confirmation", () => {
    expect(
      evaluateStructureStep(
        facts({
          events: [
            {
              eventKey: "onboarding.step_completed",
              stepKey: "structure",
              occurredAt: "2026-10-05T12:00:00.000Z",
            },
          ],
        }),
      ),
    ).toBe("complete");
  });

  it("distinguishes skipped job functions from complete and not started", () => {
    expect(evaluateJobFunctionsStep(facts())).toBe("not_started");
    expect(
      evaluateJobFunctionsStep(
        facts({
          events: [
            {
              eventKey: "onboarding.step_skipped",
              stepKey: "job_functions",
              occurredAt: "2026-10-05T12:00:00.000Z",
            },
          ],
        }),
      ),
    ).toBe("skipped");
    expect(
      evaluateJobFunctionsStep(
        facts({
          activeJobFunctionCount: 8,
          events: [
            {
              eventKey: "onboarding.step_skipped",
              stepKey: "job_functions",
              occurredAt: "2026-10-05T12:00:00.000Z",
            },
          ],
        }),
      ),
    ).toBe("complete");
  });

  it("does not treat a skipped people step as complete", () => {
    expect(
      evaluatePeopleStep(
        facts({
          events: [
            {
              eventKey: "onboarding.step_skipped",
              stepKey: "people",
              occurredAt: "2026-10-05T12:00:00.000Z",
            },
          ],
        }),
      ),
    ).toBe("skipped");
    expect(structureFirstStatusLabel("skipped")).toBe("Skipped");
    expect(structureFirstStatusLabel("complete")).toBe("Complete");
  });

  it("resumes at the first incomplete persisted step after the journey has started", () => {
    const started = facts({
      onboardingJourneyStarted: true,
      childUnitCount: 2,
      activeUnitCount: 3,
    });
    expect(resolveVisibleStructureFirstStep({ facts: started })).toBe(
      "job_functions",
    );
  });

  it("shows organisation context on first visit even when org and site already exist", () => {
    expect(resolveVisibleStructureFirstStep({ facts: facts() })).toBe(
      "organisation",
    );
  });

  it("allows reviewing an earlier complete step without restarting from zero", () => {
    const started = facts({
      onboardingJourneyStarted: true,
      childUnitCount: 1,
      activeUnitCount: 2,
    });
    expect(
      resolveVisibleStructureFirstStep({
        facts: started,
        requestedStep: "site",
      }),
    ).toBe("site");
  });

  it("does not jump ahead to readiness before skippable steps are complete or skipped", () => {
    const started = facts({ onboardingJourneyStarted: true });
    expect(
      resolveVisibleStructureFirstStep({
        facts: started,
        requestedStep: "readiness",
      }),
    ).toBe("structure");
  });

  it("only allows skipping job functions and people", () => {
    expect(isSkippableStructureFirstStep("people")).toBe(true);
    expect(isSkippableStructureFirstStep("job_functions")).toBe(true);
    expect(isSkippableStructureFirstStep("structure")).toBe(false);
    expect(isSkippableStructureFirstStep("organisation")).toBe(false);
  });

  it("treats pending invitations as persisted people progress", () => {
    expect(evaluatePeopleStep(facts({ pendingInvitationCount: 2 }))).toBe(
      "complete",
    );
  });
});
