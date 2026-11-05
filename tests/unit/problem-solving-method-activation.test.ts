import { describe, expect, it } from "vitest";

import {
  problemSolvingMethodActivationSummary,
  resolveDraftMethodActivationView,
} from "@/lib/problem-solving/method-activation";
import type { ProblemSolvingMethod } from "@/lib/problem-solving/types";

const a3Method: ProblemSolvingMethod = {
  id: "method-a3",
  name: "A3 / 8-Step Structured Problem Solving",
  code: "a3-structured",
  description:
    "Structured 8-step problem solving aligned with the A3 thinking methodology.",
  is_builtin: true,
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  current_version: {
    id: "version-a3-1",
    version_number: 1,
    status: "published",
    stages: [],
  },
};

describe("problemSolvingMethodActivationSummary", () => {
  it("summarises built-in methods in plain language", () => {
    expect(
      problemSolvingMethodActivationSummary({
        code: "five-why",
        name: "5 Why Analysis",
        description: null,
      }),
    ).toMatch(/5 Why/i);
    expect(problemSolvingMethodActivationSummary(a3Method)).toMatch(/A3/i);
  });
});

describe("resolveDraftMethodActivationView", () => {
  it("locks activation to the pinned version chosen at draft creation", () => {
    const view = resolveDraftMethodActivationView({
      methodVersionId: "version-a3-1",
      methods: [a3Method],
    });

    expect(view).toMatchObject({
      methodId: "method-a3",
      locked: true,
      label: "A3 / 8-Step Structured Problem Solving (v1)",
    });
  });

  it("uses server-provided metadata when the pinned version is no longer current", () => {
    const view = resolveDraftMethodActivationView({
      methodVersionId: "version-a3-archived",
      methods: [
        {
          ...a3Method,
          current_version: {
            id: "version-a3-2",
            version_number: 2,
            status: "published",
            stages: [],
          },
        },
      ],
      pinnedVersion: {
        methodId: "method-a3",
        methodName: "A3 / 8-Step Structured Problem Solving",
        methodCode: "a3-structured",
        versionNumber: 1,
        versionStatus: "archived",
      },
    });

    expect(view?.label).toBe("A3 / 8-Step Structured Problem Solving (v1)");
    expect(view?.versionStatus).toBe("archived");
  });
});
