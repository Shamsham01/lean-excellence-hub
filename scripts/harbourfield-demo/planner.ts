import type { HarbourfieldDemoInventory } from "./inventory";

export type HarbourfieldPlannedChange = {
  key: string;
  action: "create" | "update" | "ensure";
  summary: string;
};

export function planHarbourfieldTopUp(
  inventory: HarbourfieldDemoInventory,
): HarbourfieldPlannedChange[] {
  const planned: HarbourfieldPlannedChange[] = [];

  const want: Array<[keyof HarbourfieldDemoInventory, string]> = [
    ["suggestionProgrammePublished", "Publish suggestion programme Everyday Improvements"],
    ["maturityModelPublished", "Publish maturity model Harbourfield Operating Standard"],
    [
      "publishedOfficialMaturityResult",
      "Publish Bodmin Bakery formal maturity result (history)",
    ],
    [
      "inProgressSelfAssessment",
      "Start in-progress self-assessment on Bodmin Bakery",
    ],
    ["fiveSStandardPublished", "Publish Bodmin Bakery Packing 5S standard"],
    ["completedFiveSAudit", "Complete a 5S audit on Packing Line 1"],
    ["inProgressFiveSAudit", "Start in-progress 5S audit on Packing Line 1"],
    ["gembaDefinitionPublished", "Publish Bodmin Bakery Morning Gemba definition"],
    [
      "completedGembaWalk",
      "Complete Gemba walk with film misalignment observation",
    ],
    ["inProgressGembaWalk", "Start in-progress Gemba walk on Packing Line 1"],
    [
      "storyCorrectiveAction",
      "Ensure corrective action: Realign the film guide and confirm the first-off pack",
    ],
    [
      "overdueOpenAction",
      "Ensure overdue open action for manager home attention strip",
    ],
    [
      "problemSolvingCaseActive",
      "Activate problem-solving case: Recurring film wander on Packing Line 1",
    ],
    [
      "openProblemSolvingSession",
      "Open PPS session: Line 1 film-path cause review",
    ],
    [
      "activeStoryProject",
      "Ensure active project: Packing Line 1 film-path countermeasures",
    ],
    [
      "benefitAwaitingValidation",
      "Ensure benefit awaiting validation: Packing line film-path stability improvement",
    ],
    [
      "suggestionAwaitingReview",
      "Submit suggestion awaiting review: Improve film splice checklist at Packing Line 1",
    ],
  ];

  for (const [key, summary] of want) {
    if (!inventory[key]) {
      planned.push({ key, action: "create", summary });
    }
  }

  if (inventory.storyCorrectiveAction && !inventory.overdueOpenAction) {
    planned.push({
      key: "overdueOpenAction",
      action: "update",
      summary:
        "Normalise overdue demo action due date for manager home attention strip",
    });
  }

  return planned;
}

export function formatHarbourfieldPlan(
  planned: HarbourfieldPlannedChange[],
  organisationLabel: string,
) {
  const lines = [
    `Harbourfield demo top-up plan (${organisationLabel})`,
    planned.length === 0
      ? "No changes required — storyline inventory is complete."
      : `${planned.length} change(s) planned:`,
    ...planned.map((item, index) => `${index + 1}. [${item.action}] ${item.summary}`),
  ];

  return lines.join("\n");
}
