/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatPlatformBoundaryUserMessage,
  isNextNavigationError,
  logPlatformBoundaryError,
  PLATFORM_BOUNDARY_LOG_PREFIX,
  sanitizeBoundaryMessage,
  throwPlatformBoundaryError,
} from "@/platform/observability/platform-boundary";

describe("platform boundary observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts tokens, cookies, and passwords from log messages", () => {
    expect(
      sanitizeBoundaryMessage(
        "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb",
      ),
    ).toBe("[redacted]");
    expect(sanitizeBoundaryMessage("cookie: sb-access-token=secret")).toBe(
      "[redacted]",
    );
    expect(sanitizeBoundaryMessage("password=SuperSecret123!")).toBe(
      "[redacted]",
    );
    expect(sanitizeBoundaryMessage("refresh_token replay detected")).toBe(
      "[redacted]",
    );
  });

  it("keeps safe supabase messages", () => {
    expect(sanitizeBoundaryMessage("JWT expired")).toBe("JWT expired");
    expect(sanitizeBoundaryMessage("Could not find the table")).toBe(
      "Could not find the table",
    );
  });

  it("does not treat navigation control flow as a logged failure", () => {
    expect(
      isNextNavigationError({ digest: "NEXT_REDIRECT;replace;/login" }),
    ).toBe(true);
    expect(isNextNavigationError({ digest: "NEXT_NOT_FOUND" })).toBe(true);
    expect(isNextNavigationError(new Error("Unable to load"))).toBe(false);
  });

  it("logs category, operation, and supabase code without request secrets", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    logPlatformBoundaryError({
      category: "organisation_access",
      operation: "list_my_eligible_organisations",
      reference: "ref-123",
      route: "/platform/gemba",
      supabaseCode: "PGRST301",
      supabaseMessage: "JWT expired",
    });

    expect(error).toHaveBeenCalledTimes(1);
    const [prefix, payload] = error.mock.calls[0]!;
    expect(prefix).toBe(PLATFORM_BOUNDARY_LOG_PREFIX);
    expect(JSON.parse(String(payload))).toEqual({
      category: "organisation_access",
      operation: "list_my_eligible_organisations",
      reference: "ref-123",
      route: "/platform/gemba",
      digest: null,
      permissionKey: null,
      supabaseCode: "PGRST301",
      supabaseMessage: "JWT expired",
      routeType: null,
      renderSource: null,
    });
  });

  it("throws a user-safe error with a reference and never returns empty data", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      throwPlatformBoundaryError({
        category: "organisation_access",
        operation: "list_my_eligible_organisations",
        supabaseError: { code: "57014", message: "canceling statement" },
      }),
    ).toThrow(/Reference /);

    try {
      throwPlatformBoundaryError({
        category: "active_site",
        operation: "organisation_units",
        supabaseError: { message: "connection reset" },
      });
    } catch (error) {
      expect(error).toMatchObject({
        name: "PlatformBoundaryError",
        category: "active_site",
        operation: "organisation_units",
      });
      expect((error as Error).message).toBe(
        formatPlatformBoundaryUserMessage(
          (error as { reference: string }).reference,
        ),
      );
      expect((error as Error).message).not.toContain("connection reset");
    }
  });
});
