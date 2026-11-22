import { describe, expect, it } from "vitest";

import type { HarbourfieldDemoInventory } from "../../scripts/harbourfield-demo/inventory";
import {
  formatHarbourfieldPlan,
  planHarbourfieldTopUp,
} from "../../scripts/harbourfield-demo/planner";

const completeInventory: HarbourfieldDemoInventory = {
  maturityModelPublished: true,
  publishedOfficialMaturityResult: true,
  inProgressSelfAssessment: true,
  fiveSStandardPublished: true,
  completedFiveSAudit: true,
  inProgressFiveSAudit: true,
  gembaDefinitionPublished: true,
  completedGembaWalk: true,
  inProgressGembaWalk: true,
  storyCorrectiveAction: true,
  overdueOpenAction: true,
  problemSolvingCaseActive: true,
  openProblemSolvingSession: true,
  activeStoryProject: true,
  benefitAwaitingValidation: true,
  suggestionAwaitingReview: true,
  suggestionProgrammePublished: true,
};

describe("planHarbourfieldTopUp", () => {
  it("returns no planned changes when inventory is complete", () => {
    expect(planHarbourfieldTopUp(completeInventory)).toEqual([]);
    expect(
      formatHarbourfieldPlan(
        [],
        "Harbourfield Foods Group (harbourfield-foods-group)",
      ),
    ).toContain("No changes required");
  });

  it("plans missing storyline fixtures", () => {
    const planned = planHarbourfieldTopUp({
      ...completeInventory,
      overdueOpenAction: false,
      suggestionAwaitingReview: false,
      benefitAwaitingValidation: false,
    });

    expect(planned.map((item) => item.key)).toEqual(
      expect.arrayContaining([
        "overdueOpenAction",
        "suggestionAwaitingReview",
        "benefitAwaitingValidation",
      ]),
    );
  });
});
