import { describe, expect, it } from "vitest";

import {
  buildStructureAssistantState,
  formatStructureAssistantSummary,
} from "@/modules/leanai-context/assistant/structure-state";

describe("LeanAI structure page context", () => {
  it("summarises a single root unit without children", () => {
    expect(formatStructureAssistantSummary(1, 0)).toBe(
      "Your organisation currently has 1 active unit and no child units.",
    );
  });

  it("counts active and child units from trusted server rows", () => {
    const state = buildStructureAssistantState([
      { id: "site", parent_unit_id: null, status: "active" },
      { id: "ops", parent_unit_id: "site", status: "active" },
      { id: "old", parent_unit_id: "site", status: "retired" },
    ]);
    expect(state.relevantState.activeUnitCount).toBe(2);
    expect(state.relevantState.childUnitCount).toBe(1);
    expect(state.relevantState.archivedUnitCount).toBe(1);
    expect(state.summary).toBe(
      "Your organisation currently has 2 active units and 1 child unit.",
    );
  });
});
