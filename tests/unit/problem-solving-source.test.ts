import { describe, expect, it } from "vitest";

import { problemSolvingSourceHref } from "@/lib/problem-solving/source";

describe("problemSolvingSourceHref", () => {
  it("maps ci_project sources to the project workspace", () => {
    expect(
      problemSolvingSourceHref({
        source_resource_id: "11111111-1111-1111-1111-111111111111",
        link_role: "related",
        resource_type: "ci_project",
        context: { title: "Packaging Waste Reduction" },
      }),
    ).toBe("/platform/projects/11111111-1111-1111-1111-111111111111");
  });

  it("maps improvement_suggestion sources to the suggestion workspace", () => {
    expect(
      problemSolvingSourceHref({
        source_resource_id: "22222222-2222-2222-2222-222222222222",
        link_role: "primary",
        resource_type: "improvement_suggestion",
        context: {},
      }),
    ).toBe("/platform/suggestions/22222222-2222-2222-2222-222222222222");
  });

  it("leaves unmapped resource types as non-links", () => {
    expect(
      problemSolvingSourceHref({
        source_resource_id: "33333333-3333-3333-3333-333333333333",
        link_role: "related",
        resource_type: "unknown_resource",
        context: {},
      }),
    ).toBeNull();
  });
});
