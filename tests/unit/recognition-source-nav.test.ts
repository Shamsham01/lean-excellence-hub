import { describe, expect, it } from "vitest";

import {
  recognitionSourceHref,
  recognitionSourceOpenLabel,
} from "@/lib/recognition/source";

describe("recognition source navigation", () => {
  it("maps known source types to human-readable Open destinations", () => {
    expect(
      recognitionSourceHref(
        "improvement_suggestion",
        "11111111-1111-4111-8111-111111111111",
      ),
    ).toBe("/platform/suggestions/11111111-1111-4111-8111-111111111111");
    expect(
      recognitionSourceHref(
        "ci_project",
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toBe("/platform/projects/22222222-2222-4222-8222-222222222222");
    expect(
      recognitionSourceHref("action", "33333333-3333-4333-8333-333333333333"),
    ).toBe("/platform/actions/33333333-3333-4333-8333-333333333333");
    expect(
      recognitionSourceHref("unknown", "44444444-4444-4444-8444-444444444444"),
    ).toBeNull();
  });

  it("prefers the source title and never uses a raw UUID as the Open label", () => {
    expect(
      recognitionSourceOpenLabel(
        "improvement_suggestion",
        "Pre-stage changeover tooling",
      ),
    ).toBe("Open Pre-stage changeover tooling");
    expect(recognitionSourceOpenLabel("ci_project", null)).toBe("Open project");
    expect(recognitionSourceOpenLabel("improvement_suggestion", "   ")).toBe(
      "Open suggestion",
    );
    expect(
      recognitionSourceOpenLabel(
        "improvement_suggestion",
        "Pre-stage changeover tooling",
      ),
    ).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });
});
