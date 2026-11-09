/**
 * @vitest-environment node
 *
 * Guards Supabase request count for a unit-scoped manager Suggestions overview render.
 * Shell layout batches permission probes; the page adds portfolio/overview RPCs only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
const from = vi.fn();

vi.mock("next/navigation", () => ({
  unstable_rethrow: () => undefined,
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: async () => "/platform/suggestions",
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc, from }),
}));

import { resetPermissionResolutionStoreForTests } from "@/modules/platform-shell/permission-resolution-store";
import {
  currentMemberHasGrantPermission,
  currentMemberHasPermission,
  prefetchMemberGrantPermissions,
  prefetchMemberPermissions,
  prefetchPlatformShellPermissionProbes,
} from "@/modules/platform-shell/permissions";
import { suggestionsOverviewPermissionKeys } from "@/lib/suggestions/suggestion-page-permission-keys";
import {
  collectPlatformShellGrantPermissionKeys,
  collectPlatformShellPermissionKeys,
} from "@/modules/platform-shell/shell-permission-keys";
import { WORKPLACE_VIEW_PERMISSION } from "@/modules/workplace/access";

const shellMemberKeys = collectPlatformShellPermissionKeys();
const shellGrantKeys = collectPlatformShellGrantPermissionKeys();

function mockQueryChain(result: { data: unknown; error: null }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    gte: () => chain,
  };
  return Object.assign(Promise.resolve(result), chain);
}

async function simulateSuggestionsOverviewPermissionPhase() {
  rpc.mockImplementation(
    async (fn: string, args?: { target_permission_keys?: string[] }) => {
      if (fn === "member_has_permissions") {
        const keys = args?.target_permission_keys ?? shellMemberKeys;
        return {
          data: Object.fromEntries(keys.map((key) => [key, true])),
          error: null,
        };
      }
      if (fn === "member_has_grant_permissions") {
        const keys = args?.target_permission_keys ?? shellGrantKeys;
        return {
          data: Object.fromEntries(keys.map((key) => [key, true])),
          error: null,
        };
      }
      if (fn === "member_has_grant_permission") {
        return { data: true, error: null };
      }
      if (fn === "member_has_permission") {
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
  );

  await prefetchPlatformShellPermissionProbes();
  await Promise.all([
    prefetchMemberPermissions([
      ...suggestionsOverviewPermissionKeys,
      WORKPLACE_VIEW_PERMISSION,
    ]),
    prefetchMemberGrantPermissions(["suggestions.read"]),
  ]);

  await Promise.all([
    currentMemberHasGrantPermission("suggestions.read"),
    currentMemberHasPermission("suggestions.submit"),
    currentMemberHasPermission("suggestions.review"),
    currentMemberHasPermission("suggestions.programmes.manage"),
    currentMemberHasPermission("suggestions.manage"),
    currentMemberHasPermission(WORKPLACE_VIEW_PERMISSION),
  ]);
}

async function simulateSuggestionsOverviewDataPhase() {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === "get_suggestions_overview") {
      return { data: { pipeline: {} }, error: null };
    }
    if (fn === "get_suggestion_portfolio") {
      return {
        data: { items: [], total_count: 0, page: 1, page_size: 25 },
        error: null,
      };
    }
    if (fn === "current_organisation_id") {
      return { data: "org-1", error: null };
    }
    return { data: null, error: null };
  });

  from.mockImplementation(() =>
    mockQueryChain({
      data: [],
      error: null,
    }),
  );

  const supabase = { rpc, from };

  await Promise.all([
    supabase.rpc("get_suggestions_overview"),
    supabase.rpc("get_suggestion_portfolio", {
      target_page: 1,
      target_page_size: 25,
    }),
    supabase.rpc("current_organisation_id"),
  ]);
}

describe("Suggestions overview Supabase request budget", () => {
  beforeEach(() => {
    resetPermissionResolutionStoreForTests();
    vi.clearAllMocks();
  });

  it("stays under 15 rpc calls for permission + overview data after shell prefetch", async () => {
    await simulateSuggestionsOverviewPermissionPhase();
    const permissionRpcCount = rpc.mock.calls.length;

    await simulateSuggestionsOverviewDataPhase();
    const totalRpcCount = rpc.mock.calls.length;

    expect(permissionRpcCount).toBeLessThanOrEqual(4);
    expect(totalRpcCount).toBeLessThanOrEqual(14);
  });
});
