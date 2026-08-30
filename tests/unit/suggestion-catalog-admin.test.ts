import { describe, expect, it } from "vitest";

import {
  categoryEmptyStateMessage,
  filterCatalogueBySearch,
  filterCatalogueByStatus,
  formatProgrammeDisplayStatus,
  getProgrammeDisplayStatus,
  programmeEmptyStateMessage,
  programmeHasPublishedHistory,
} from "@/modules/suggestions/catalog-admin";

const programmes = [
  { id: "1", name: "Continuous Improvement", code: "CI", status: "active" },
  { id: "2", name: "Got an Idea", code: "GAI01", status: "deactivated" },
  { id: "3", name: "Future Ideas", code: "FI", status: "active" },
];

const categories = [
  { id: "a", name: "Safety", code: "SAFE", status: "active" },
  { id: "b", name: "Old Category", code: "OLD", status: "deactivated" },
];

describe("suggestion catalog admin filters", () => {
  it("defaults active programme filter to active programmes only", () => {
    expect(filterCatalogueByStatus(programmes, "active")).toEqual([
      programmes[0],
      programmes[2],
    ]);
  });

  it("hides deactivated programmes under active filter", () => {
    expect(
      filterCatalogueByStatus(programmes, "active").some(
        (programme) => programme.id === "2",
      ),
    ).toBe(false);
  });

  it("shows deactivated programmes with deactivated filter", () => {
    expect(filterCatalogueByStatus(programmes, "deactivated")).toEqual([
      programmes[1],
    ]);
  });

  it("shows all programmes with all filter", () => {
    expect(filterCatalogueByStatus(programmes, "all")).toEqual(programmes);
  });

  it("matches programme search by name", () => {
    expect(
      filterCatalogueBySearch(programmes, "continuous").map(
        (programme) => programme.id,
      ),
    ).toEqual(["1"]);
  });

  it("matches programme search by code case-insensitively", () => {
    expect(
      filterCatalogueBySearch(programmes, "gai01").map(
        (programme) => programme.id,
      ),
    ).toEqual(["2"]);
  });

  it("defaults active category filter to active categories only", () => {
    expect(filterCatalogueByStatus(categories, "active")).toEqual([
      categories[0],
    ]);
  });

  it("hides deactivated categories under active filter", () => {
    expect(
      filterCatalogueByStatus(categories, "active").some(
        (category) => category.id === "b",
      ),
    ).toBe(false);
  });

  it("shows deactivated categories with deactivated filter", () => {
    expect(filterCatalogueByStatus(categories, "deactivated")).toEqual([
      categories[1],
    ]);
  });

  it("matches category search by name and code", () => {
    expect(filterCatalogueBySearch(categories, "safe")).toEqual([
      categories[0],
    ]);
    expect(filterCatalogueBySearch(categories, "old")).toEqual([categories[1]]);
  });

  it("derives draft programme display status from version lifecycle", () => {
    const draftProgramme = programmes[2];
    if (!draftProgramme) {
      throw new Error("fixture missing");
    }

    expect(
      getProgrammeDisplayStatus(draftProgramme, [
        { programme_id: "3", lifecycle: "draft" },
      ]),
    ).toBe("draft");
    expect(formatProgrammeDisplayStatus("draft")).toBe("Draft");
  });

  it("reports published history when any non-draft version exists", () => {
    expect(
      programmeHasPublishedHistory([
        { programme_id: "1", lifecycle: "draft" },
        { programme_id: "1", lifecycle: "archived" },
      ]),
    ).toBe(true);
  });

  it("provides filtered empty-state messages", () => {
    expect(programmeEmptyStateMessage("active", "")).toBe(
      "No active programmes yet.",
    );
    expect(programmeEmptyStateMessage("deactivated", "")).toBe(
      "No deactivated programmes.",
    );
    expect(programmeEmptyStateMessage("active", "missing")).toBe(
      "No programmes match your search.",
    );
    expect(categoryEmptyStateMessage("active", "")).toBe(
      "No active categories yet.",
    );
  });
});
