import { describe, expect, it } from "vitest";

/**
 * Permission-aware empty-state copy for problem solving portfolio.
 * Mirrors the branching in CasePortfolio without rendering the component.
 */
function problemSolvingEmptyCopy(input: {
  canCreate: boolean;
  hasActiveFilters: boolean;
}) {
  if (input.hasActiveFilters) {
    return {
      title: "No cases match your filters",
      description: input.canCreate
        ? "Adjust search or filters, or register a new problem solving case."
        : "Adjust search or filters.",
      showCreate: input.canCreate,
    };
  }

  return {
    title: input.canCreate
      ? "No problem-solving cases yet"
      : "No problem-solving cases are currently available in your scope",
    description: input.canCreate
      ? "Register a new case to start structured root cause analysis."
      : "Cases shared within your access scope will appear here when they are available.",
    showCreate: input.canCreate,
  };
}

function suggestionConfigurationMessage(input: {
  programmeCount: number;
  categoryCount: number;
}) {
  const missingProgramme = input.programmeCount === 0;
  const missingCategories = input.categoryCount === 0;

  if (missingProgramme && missingCategories) {
    return "Suggestion submission is not available yet because your organisation has not configured a suggestion programme or categories.";
  }

  if (missingProgramme) {
    return "Suggestion submission is not available yet because your organisation has not configured a suggestion programme.";
  }

  return "Suggestion submission is not available yet because your organisation has not configured suggestion categories.";
}

describe("team member experience copy", () => {
  it("does not suggest creating cases without create permission", () => {
    const copy = problemSolvingEmptyCopy({
      canCreate: false,
      hasActiveFilters: false,
    });

    expect(copy.title).toContain("currently available in your scope");
    expect(copy.description).not.toContain("register");
    expect(copy.showCreate).toBe(false);
  });

  it("keeps create guidance for users with create permission", () => {
    const copy = problemSolvingEmptyCopy({
      canCreate: true,
      hasActiveFilters: false,
    });

    expect(copy.showCreate).toBe(true);
    expect(copy.description).toContain("Register a new case");
  });

  it("explains missing suggestion programme configuration", () => {
    expect(
      suggestionConfigurationMessage({
        programmeCount: 0,
        categoryCount: 2,
      }),
    ).toContain("has not configured a suggestion programme");
  });

  it("explains missing suggestion categories", () => {
    expect(
      suggestionConfigurationMessage({
        programmeCount: 1,
        categoryCount: 0,
      }),
    ).toContain("has not configured suggestion categories");
  });
});
