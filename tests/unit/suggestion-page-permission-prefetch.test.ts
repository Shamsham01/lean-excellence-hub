/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  suggestionsOverviewPermissionKeys,
  suggestionsReviewPermissionKeys,
} from "@/lib/suggestions/suggestion-page-permission-keys";
import { SUGGESTIONS_PERMISSIONS } from "@/modules/operational/permissions";

describe("Suggestions page permission keys", () => {
  it("covers the overview action gates without widening nav keys", () => {
    expect([...suggestionsOverviewPermissionKeys]).toEqual([
      SUGGESTIONS_PERMISSIONS.read,
      SUGGESTIONS_PERMISSIONS.submit,
      SUGGESTIONS_PERMISSIONS.review,
      SUGGESTIONS_PERMISSIONS.programmesManage,
      SUGGESTIONS_PERMISSIONS.manage,
    ]);
  });

  it("covers the review queue gates", () => {
    expect([...suggestionsReviewPermissionKeys]).toEqual([
      SUGGESTIONS_PERMISSIONS.review,
      SUGGESTIONS_PERMISSIONS.manage,
    ]);
  });
});

describe("Suggestions listing permission prefetch", () => {
  it("batches overview permission probes before sequential gates", () => {
    const source = readFileSync(
      "src/app/(platform)/platform/suggestions/page.tsx",
      "utf8",
    );

    expect(source).toContain("prefetchMemberPermissions");
    expect(source).toContain("suggestionsOverviewPermissionKeys");
    expect(source.indexOf("prefetchMemberPermissions")).toBeLessThan(
      source.indexOf('currentMemberHasPermission("suggestions.read")'),
    );
  });

  it("batches review queue permission probes before sequential gates", () => {
    const source = readFileSync(
      "src/app/(platform)/platform/suggestions/review/page.tsx",
      "utf8",
    );

    expect(source).toContain("prefetchMemberPermissions");
    expect(source).toContain("suggestionsReviewPermissionKeys");
    expect(source.indexOf("prefetchMemberPermissions")).toBeLessThan(
      source.indexOf('currentMemberHasPermission("suggestions.review")'),
    );
  });
});

describe("Suggestions overview keeps unfiltered metrics beside filtered totals", () => {
  it("still loads overview and portfolio as separate requests", () => {
    const source = readFileSync(
      "src/app/(platform)/platform/suggestions/page.tsx",
      "utf8",
    );

    expect(source).toContain('supabase.rpc("get_suggestions_overview")');
    expect(source).toContain("fetchSuggestionPortfolio(supabase, filters)");
    expect(source).not.toContain("countAllVisibleSuggestions");
  });
});

vi.mock("server-only", () => ({}));

const rpc = vi.fn();

vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
  },
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: async () => "/platform/suggestions",
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc }),
}));

describe("Suggestions overview permission batch resolution", () => {
  beforeEach(async () => {
    const { resetPermissionResolutionStoreForTests } =
      await import("@/modules/platform-shell/permission-resolution-store");
    resetPermissionResolutionStoreForTests();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("serves overview gates from one batch RPC", async () => {
    const { prefetchMemberPermissions, currentMemberHasPermission } =
      await import("@/modules/platform-shell/permissions");

    rpc.mockResolvedValueOnce({
      data: {
        "suggestions.read": true,
        "suggestions.submit": true,
        "suggestions.review": false,
        "suggestions.programmes.manage": false,
        "suggestions.manage": false,
      },
      error: null,
    });

    await prefetchMemberPermissions([...suggestionsOverviewPermissionKeys]);

    await expect(currentMemberHasPermission("suggestions.read")).resolves.toBe(
      true,
    );
    await expect(
      currentMemberHasPermission("suggestions.submit"),
    ).resolves.toBe(true);
    await expect(
      currentMemberHasPermission("suggestions.review"),
    ).resolves.toBe(false);
    await expect(
      currentMemberHasPermission("suggestions.programmes.manage"),
    ).resolves.toBe(false);
    await expect(
      currentMemberHasPermission("suggestions.manage"),
    ).resolves.toBe(false);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("member_has_permissions", {
      target_permission_keys: [...suggestionsOverviewPermissionKeys],
    });
  });
});
