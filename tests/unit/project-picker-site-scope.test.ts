import { expect, it, vi } from "vitest";
import { resolveSiteUnitId } from "@/modules/organisation/applicability-unit-tree";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({})),
}));
vi.mock("@/lib/organisation/selector-options", () => ({
  loadSiteScopedSelectorOptions: vi.fn(async () => ({
    requiresSiteSelection: true,
    context: { mode: "organisation" },
  })),
}));
vi.mock("@/lib/projects/supabase-untyped", () => ({ callProjectRpc: rpc }));
import { loadProjectPickerOptions } from "@/lib/projects/load-project-picker-options";

it("offers site and sibling projects for a line record, while excluding another site", async () => {
  const units = [
    {
      id: "site-a",
      name: "Site A",
      code: "a",
      unit_type: "site",
      parent_unit_id: null,
    },
    {
      id: "line",
      name: "Line",
      code: "l",
      unit_type: "line",
      parent_unit_id: "site-a",
    },
    {
      id: "site-b",
      name: "Site B",
      code: "b",
      unit_type: "site",
      parent_unit_id: null,
    },
  ];
  const projects = [
    { id: "site-project", unit_id: "site-a", site: "site-a" },
    { id: "sibling-project", unit_id: "other-line", site: "site-a" },
    { id: "other-site-project", unit_id: "site-b", site: "site-b" },
  ];
  rpc.mockImplementation(async (_client, _name, args) => {
    const items = projects.filter(
      (p) =>
        p.site === args.target_site_unit_id &&
        (!args.target_unit_id || p.unit_id === args.target_unit_id),
    );
    return {
      data: { items, total_count: items.length, page: 1, page_size: 100 },
    };
  });
  const siteUnitId = resolveSiteUnitId("line", units);
  for (const record of ["case", "action"]) {
    const result = await loadProjectPickerOptions(undefined, { siteUnitId });
    expect(result.requiresSiteSelection, record).toBe(false);
    expect(
      result.projects.map((p) => p.id),
      record,
    ).toEqual(["site-project", "sibling-project"]);
    expect(rpc.mock.lastCall![2]).not.toHaveProperty("target_unit_id");
  }
});
