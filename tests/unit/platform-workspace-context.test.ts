/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requirePlatformAccess = vi.fn(async () => undefined);
const loadCurrentOrganisationId = vi.fn();
const listEligibleOrganisations = vi.fn();
const loadActiveSiteContext = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

vi.mock("@/modules/identity/session", () => ({
  requirePlatformAccess: () => requirePlatformAccess(),
}));

vi.mock("@/modules/organisations/context", () => ({
  loadCurrentOrganisationId: () => loadCurrentOrganisationId(),
  listEligibleOrganisations: () => listEligibleOrganisations(),
}));

vi.mock("@/modules/organisation/site-context-server", () => ({
  loadActiveSiteContext: () => loadActiveSiteContext(),
}));

import { loadPlatformWorkspaceContext } from "@/modules/platform-shell/workspace-context";
import { PlatformBoundaryError } from "@/platform/observability/platform-boundary";

const organisation = {
  membership_id: "mem-1",
  organisation_code: "apex",
  organisation_id: "org-1",
  organisation_name: "Apex Manufacturing",
  selected: true,
};

const siteContext = {
  mode: "site" as const,
  activeSiteId: "site-1",
  locked: true,
  sites: [{ id: "site-1", name: "Cornwall Plant", code: "cornwall-plant" }],
};

describe("loadPlatformWorkspaceContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePlatformAccess.mockResolvedValue(undefined);
    loadCurrentOrganisationId.mockResolvedValue("org-1");
    listEligibleOrganisations.mockResolvedValue([organisation]);
    loadActiveSiteContext.mockResolvedValue({
      units: [],
      context: siteContext,
    });
  });

  it("loads the shared workspace context for repeated navigation cycles", async () => {
    for (let cycle = 0; cycle < 25; cycle += 1) {
      await expect(loadPlatformWorkspaceContext()).resolves.toEqual({
        current: organisation,
        organisations: [organisation],
        siteContext,
      });
    }

    expect(requirePlatformAccess).toHaveBeenCalledTimes(25);
    expect(listEligibleOrganisations).toHaveBeenCalledTimes(25);
    expect(loadActiveSiteContext).toHaveBeenCalledTimes(25);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects when organisation context is genuinely missing", async () => {
    loadCurrentOrganisationId.mockResolvedValueOnce(null);
    await expect(loadPlatformWorkspaceContext()).rejects.toThrow(
      "REDIRECT:/select-organisation",
    );
  });

  it("does not swallow organisation loader failures as empty access", async () => {
    listEligibleOrganisations.mockRejectedValueOnce(
      new PlatformBoundaryError({
        category: "organisation_access",
        operation: "list_my_eligible_organisations",
        reference: "ref-org",
      }),
    );

    await expect(loadPlatformWorkspaceContext()).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not swallow active-site loader failures as an empty site list", async () => {
    loadActiveSiteContext.mockRejectedValueOnce(
      new PlatformBoundaryError({
        category: "active_site",
        operation: "organisation_units",
        reference: "ref-site",
      }),
    );

    await expect(loadPlatformWorkspaceContext()).rejects.toBeInstanceOf(
      PlatformBoundaryError,
    );
    expect(redirect).not.toHaveBeenCalled();
  });
});
