/**
 * @vitest-environment node
 *
 * Counts real shell + Suggestions overview loaders against a Supabase request cap.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type SupabaseCall = { kind: "rpc" | "from"; target: string };

const supabaseCalls: SupabaseCall[] = [];

function recordCall(kind: SupabaseCall["kind"], target: string) {
  supabaseCalls.push({ kind, target });
}

function mockQueryChain(result: { data: unknown; error: null }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    gte: () => chain,
    maybeSingle: () => Promise.resolve(result),
  };
  return Object.assign(Promise.resolve(result), chain);
}

function buildSupabaseMock() {
  const rpc = vi.fn(async (fn: string, args?: Record<string, unknown>) => {
    recordCall("rpc", fn);
    if (
      fn === "member_has_permissions" ||
      fn === "member_has_grant_permissions"
    ) {
      const keys = (args?.target_permission_keys as string[]) ?? [];
      return {
        data: Object.fromEntries(keys.map((key) => [key, true])),
        error: null,
      };
    }
    if (
      fn === "member_has_permission" ||
      fn === "member_has_grant_permission"
    ) {
      return { data: true, error: null };
    }
    if (fn === "get_suggestions_overview") {
      return {
        data: {
          submitted_this_month: 0,
          awaiting_review: 0,
          accepted: 0,
          implementing: 0,
          implemented: 0,
          pipeline: {},
        },
        error: null,
      };
    }
    if (fn === "get_suggestion_portfolio") {
      return {
        data: { items: [], total_count: 0, page: 1, page_size: 25 },
        error: null,
      };
    }
    if (fn === "get_available_suggestion_submission_configuration") {
      return { data: { programmes: [], categories: [] }, error: null };
    }
    if (fn === "current_organisation_id") {
      return { data: "00000000-0000-0000-0000-000000000099", error: null };
    }
    return { data: null, error: null };
  });

  const from = vi.fn((table: string) => {
    recordCall("from", table);
    return mockQueryChain({ data: [], error: null });
  });

  return { rpc, from };
}

vi.mock("next/navigation", () => ({
  unstable_rethrow: () => undefined,
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: async () => "/platform/suggestions",
}));

const supabase = buildSupabaseMock();

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => supabase,
}));

vi.mock("@/modules/billing/load-current-entitlements", () => ({
  loadCurrentOrganisationEntitlements: async () => ({
    planCode: "professional",
    billingState: "active",
    hasLegacyUnmeteredAccess: false,
    modules: {},
  }),
}));

vi.mock("@/modules/platform-analytics/suggestions", () => ({
  loadSuggestionsAnalytics: async () => ({
    stats: [],
    trend: [],
    statusBreakdown: [],
    comparisonBars: [],
    ageingRows: [],
    hasData: false,
  }),
}));

vi.mock("@/modules/workplace/access", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/workplace/access")>();
  return {
    ...actual,
    WORKPLACE_VIEW_PERMISSION: "workplace.view",
  };
});

import { resetPermissionResolutionStoreForTests } from "@/modules/platform-shell/permission-resolution-store";
import { buildVisibleNavigation } from "@/modules/platform-shell/visible-navigation";
import {
  fetchSuggestionPortfolio,
  fetchSuggestionsOverview,
} from "@/lib/suggestions/fetch-suggestion-portfolio";
import { loadSuggestionPortfolioFilterOptions } from "@/lib/suggestions/suggestion-portfolio-filter-options";
import {
  currentMemberHasGrantPermission,
  currentMemberHasPermission,
  prefetchMemberGrantPermissions,
  prefetchMemberPermissions,
  prefetchPlatformShellPermissionProbes,
} from "@/modules/platform-shell/permissions";
import { suggestionsOverviewPermissionKeys } from "@/lib/suggestions/suggestion-page-permission-keys";
import { WORKPLACE_VIEW_PERMISSION } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";

async function renderSuggestionsOverviewLikePage() {
  await prefetchPlatformShellPermissionProbes();
  await Promise.all([
    prefetchMemberPermissions([
      ...suggestionsOverviewPermissionKeys,
      WORKPLACE_VIEW_PERMISSION,
    ]),
    prefetchMemberGrantPermissions(["suggestions.read"]),
  ]);

  const [canReadPortfolio] = await Promise.all([
    currentMemberHasGrantPermission("suggestions.read"),
    currentMemberHasPermission("suggestions.submit"),
    currentMemberHasPermission(WORKPLACE_VIEW_PERMISSION),
  ]);

  if (!canReadPortfolio) {
    throw new Error("Expected portfolio read in budget test");
  }

  const client = await createServerSupabaseClient();

  await Promise.all([
    fetchSuggestionsOverview(client),
    fetchSuggestionPortfolio(client, {
      q: null,
      status: null,
      programme: null,
      category: null,
      originUnit: null,
      reviewer: "all",
      sort: "newest",
      page: 1,
      pageSize: 25,
    }),
    loadSuggestionPortfolioFilterOptions(client, {
      programme: null,
      category: null,
      originUnit: null,
    }),
  ]);

  const { loadSuggestionsAnalytics } =
    await import("@/modules/platform-analytics/suggestions");
  await loadSuggestionsAnalytics(client, {
    days: 30,
    start: "2026-01-01T00:00:00.000Z",
    end: "2026-01-31T00:00:00.000Z",
    previousStart: "2025-12-01T00:00:00.000Z",
    previousEnd: "2025-12-31T00:00:00.000Z",
  });
}

describe("Suggestions overview Supabase request budget", () => {
  beforeEach(() => {
    resetPermissionResolutionStoreForTests();
    supabaseCalls.length = 0;
    vi.clearAllMocks();
  });

  it("shell navigation plus overview loaders stay within 15 supabase calls", async () => {
    await buildVisibleNavigation();
    await renderSuggestionsOverviewLikePage();

    const totalCalls = supabaseCalls.length;
    const rpcCalls = supabaseCalls.filter((call) => call.kind === "rpc").length;
    const fromCalls = supabaseCalls.filter(
      (call) => call.kind === "from",
    ).length;

    expect(totalCalls).toBeLessThanOrEqual(15);
    expect(rpcCalls).toBeGreaterThan(0);
    expect(fromCalls).toBeGreaterThan(0);
  });
});
