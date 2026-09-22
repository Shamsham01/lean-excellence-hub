/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const throwPlatformBoundaryError = vi.fn((input: unknown) => {
  throw Object.assign(new Error("PlatformBoundaryError"), { input });
});
const readRequestPathname = vi.fn(async () => "/platform/problem-solving/case");

vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

vi.mock("@/platform/observability/platform-boundary", () => ({
  PlatformBoundaryError: class PlatformBoundaryError extends Error {
    readonly category: string;
    constructor(input: {
      category: string;
      operation: string;
      reference: string;
    }) {
      super("PlatformBoundaryError");
      this.name = "PlatformBoundaryError";
      this.category = input.category;
    }
  },
  throwPlatformBoundaryError: (input: unknown) =>
    throwPlatformBoundaryError(input),
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: () => readRequestPathname(),
}));

import {
  resolveProblemSolvingListResult,
  resolveProblemSolvingLoadError,
} from "@/lib/problem-solving/resolve-supabase-load";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("resolveProblemSolvingListResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty arrays for genuine empty success", async () => {
    await expect(
      resolveProblemSolvingListResult(
        { data: [], error: null },
        "problem_solving_analyses",
      ),
    ).resolves.toEqual([]);

    await expect(
      resolveProblemSolvingListResult(
        { data: null, error: null },
        "problem_solving_analyses",
      ),
    ).resolves.toEqual([]);
  });

  it("raises an organisation boundary for infrastructure failures", async () => {
    await expect(
      resolveProblemSolvingListResult(
        {
          data: null,
          error: { code: "57014", message: "canceling statement" },
        },
        "problem_solving_current_condition_items",
      ),
    ).rejects.toThrow("PlatformBoundaryError");

    expect(throwPlatformBoundaryError).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "organisation_access",
        operation: "problem_solving_current_condition_items",
      }),
    );
    expect(notFound).not.toHaveBeenCalled();
  });

  it("routes authorization denial to notFound instead of empty data", async () => {
    await expect(
      resolveProblemSolvingListResult(
        { data: null, error: { code: "42501", message: "not authorised" } },
        "comments",
      ),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("routes JWT session failures to auth boundary errors", async () => {
    await expect(
      resolveProblemSolvingListResult(
        { data: null, error: { code: "PGRST301", message: "JWT expired" } },
        "organisation_memberships",
      ),
    ).rejects.toThrow("PlatformBoundaryError");

    expect(throwPlatformBoundaryError).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "auth",
        operation: "organisation_memberships",
      }),
    );
    expect(notFound).not.toHaveBeenCalled();
  });

  it("rethrows existing platform boundary errors without wrapping", async () => {
    const boundary = new PlatformBoundaryError({
      category: "auth",
      operation: "comments",
      reference: "test-ref",
    });

    await expect(
      resolveProblemSolvingLoadError(boundary, "comments"),
    ).rejects.toBe(boundary);
    expect(throwPlatformBoundaryError).not.toHaveBeenCalled();
  });
});
