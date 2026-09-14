/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const order = vi.fn();
const cookies = vi.fn(async () => ({
  get: () => undefined,
}));

vi.mock("next/headers", () => ({
  cookies: () => cookies(),
}));

vi.mock("@/platform/http/request-path", () => ({
  readRequestPathname: async () => "/platform/gemba",
}));

vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order,
        }),
      }),
    }),
  }),
}));

import { loadAccessibleOrganisationUnits } from "@/modules/organisation/site-context-server";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

describe("loadAccessibleOrganisationUnits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("fails closed on organisation_units query errors instead of returning []", async () => {
    order.mockResolvedValueOnce({
      data: null,
      error: { code: "57014", message: "statement timeout" },
    });

    await expect(loadAccessibleOrganisationUnits()).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
  });

  it("returns units when the query succeeds", async () => {
    order.mockResolvedValueOnce({
      data: [
        {
          id: "unit-1",
          code: "cornwall-plant",
          name: "Cornwall Plant",
          unit_type: "plant",
          parent_unit_id: null,
          status: "active",
        },
      ],
      error: null,
    });

    await expect(loadAccessibleOrganisationUnits()).resolves.toHaveLength(1);
  });
});
