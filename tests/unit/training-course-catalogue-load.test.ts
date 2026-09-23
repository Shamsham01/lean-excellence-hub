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
const readRequestPathname = vi.fn(async () => "/platform/training/courses");

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
  resolveTrainingCatalogListResult,
  resolveTrainingCatalogLoadError,
  resolveTrainingCatalogRequiredData,
} from "@/modules/training/resolve-catalog-load";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("training catalogue query resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty arrays for a genuine empty catalogue", async () => {
    await expect(
      resolveTrainingCatalogListResult(
        { data: [], error: null },
        "training_courses",
      ),
    ).resolves.toEqual([]);

    await expect(
      resolveTrainingCatalogListResult(
        { data: null, error: null },
        "training_courses",
      ),
    ).resolves.toEqual([]);
  });

  it("does not treat infrastructure failures as an empty catalogue", async () => {
    await expect(
      resolveTrainingCatalogListResult(
        {
          data: null,
          error: { code: "57014", message: "canceling statement" },
        },
        "training_courses",
      ),
    ).rejects.toThrow("PlatformBoundaryError");

    expect(throwPlatformBoundaryError).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "organisation_access",
        operation: "training_courses",
      }),
    );
    expect(notFound).not.toHaveBeenCalled();
  });

  it("does not treat a failed course lookup as not found", async () => {
    await expect(
      resolveTrainingCatalogRequiredData(
        {
          data: null,
          error: { code: "XX000", message: "postgres connection reset" },
        },
        "training_courses",
      ),
    ).rejects.toThrow("PlatformBoundaryError");

    expect(throwPlatformBoundaryError).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "organisation_access",
        operation: "training_courses",
      }),
    );
    expect(notFound).not.toHaveBeenCalled();
  });

  it("routes a missing course without a query error to notFound", async () => {
    await expect(
      resolveTrainingCatalogRequiredData(
        { data: null, error: null },
        "training_courses",
      ),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("routes authorization denial to notFound instead of empty data", async () => {
    await expect(
      resolveTrainingCatalogListResult(
        { data: null, error: { code: "42501", message: "not authorised" } },
        "training_course_versions",
      ),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("rethrows existing platform boundary errors without wrapping", async () => {
    const boundary = new PlatformBoundaryError({
      category: "auth",
      operation: "training_courses",
      reference: "test-ref",
    });

    await expect(
      resolveTrainingCatalogLoadError(boundary, "training_courses"),
    ).rejects.toBe(boundary);
    expect(throwPlatformBoundaryError).not.toHaveBeenCalled();
  });
});
