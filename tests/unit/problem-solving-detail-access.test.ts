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

import { resolveProblemSolvingDetailAccess } from "@/lib/problem-solving/detail-access";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("resolveProblemSolvingDetailAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns detail data when the RPC succeeds", async () => {
    const detail = { id: "case-1", title: "Seal defects" };

    await expect(
      resolveProblemSolvingDetailAccess({
        data: detail,
        error: null,
      }),
    ).resolves.toBe(detail);
  });

  it("routes explicit authorization denial to notFound", async () => {
    await expect(
      resolveProblemSolvingDetailAccess({
        data: null,
        error: { code: "42501", message: "not authorised" },
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(throwPlatformBoundaryError).not.toHaveBeenCalled();
  });

  it("routes missing case codes to notFound", async () => {
    await expect(
      resolveProblemSolvingDetailAccess({
        data: null,
        error: { code: "P0002", message: "case not found" },
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("routes JWT session failures to auth boundary errors", async () => {
    await expect(
      resolveProblemSolvingDetailAccess({
        data: null,
        error: { code: "PGRST301", message: "JWT expired" },
      }),
    ).rejects.toThrow("PlatformBoundaryError");
    expect(throwPlatformBoundaryError).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "auth",
        operation: "get_problem_solving_detail",
      }),
    );
    expect(notFound).not.toHaveBeenCalled();
  });

  it("routes infrastructure failures to organisation boundary errors", async () => {
    await expect(
      resolveProblemSolvingDetailAccess({
        data: null,
        error: { code: "57014", message: "canceling statement" },
      }),
    ).rejects.toThrow("PlatformBoundaryError");
    expect(throwPlatformBoundaryError).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "organisation_access",
        operation: "get_problem_solving_detail",
      }),
    );
    expect(notFound).not.toHaveBeenCalled();
  });

  it("rethrows existing platform boundary errors without wrapping", async () => {
    const boundary = new PlatformBoundaryError({
      category: "auth",
      operation: "get_problem_solving_detail",
      reference: "test-ref",
    });

    await expect(
      resolveProblemSolvingDetailAccess({
        data: null,
        error: boundary,
      }),
    ).rejects.toBe(boundary);
    expect(throwPlatformBoundaryError).not.toHaveBeenCalled();
  });

  it("routes null detail without error to notFound", async () => {
    await expect(
      resolveProblemSolvingDetailAccess({
        data: null,
        error: null,
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
