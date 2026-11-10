import { isSiteUnitType } from "@/modules/organisation/site-semantics";
import {
  buildOrganisationUnitTree,
  collectDescendantUnitIds,
  type FlatOrganisationUnit,
  type OrganisationUnitNode,
} from "@/modules/organisation/unit-hierarchy";

export function resolveSiteUnitId(
  unitId: string,
  units: FlatOrganisationUnit[],
): string | null {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  let current = byId.get(unitId);
  const visited = new Set<string>();

  while (current) {
    if (isSiteUnitType(current.unit_type)) {
      return current.id;
    }
    if (!current.parent_unit_id || visited.has(current.id)) {
      return null;
    }
    visited.add(current.id);
    current = byId.get(current.parent_unit_id);
  }

  return null;
}

export type ApplicabilitySiteGroup = {
  siteId: string;
  siteName: string;
  tree: OrganisationUnitNode[];
  selectableIds: Set<string>;
};

export function buildApplicabilitySiteGroups(
  hierarchyUnits: FlatOrganisationUnit[],
  selectableUnitIds: ReadonlySet<string>,
): ApplicabilitySiteGroup[] {
  const activeUnits = hierarchyUnits.filter(
    (unit) => unit.status !== "retired",
  );
  const sites = activeUnits.filter((unit) => isSiteUnitType(unit.unit_type));
  const groups: ApplicabilitySiteGroup[] = [];

  for (const site of sites.sort((a, b) =>
    a.name.localeCompare(b.name, "en-GB"),
  )) {
    const descendantIds = collectDescendantUnitIds(activeUnits, site.id);
    const selectableIds = new Set<string>();
    for (const id of descendantIds) {
      if (selectableUnitIds.has(id) && id !== site.id) {
        selectableIds.add(id);
      }
    }
    if (selectableIds.size === 0) {
      continue;
    }
    const scoped = activeUnits.filter((unit) => descendantIds.has(unit.id));
    const tree = buildOrganisationUnitTree(scoped);
    groups.push({
      siteId: site.id,
      siteName: site.name,
      tree,
      selectableIds,
    });
  }

  return groups;
}

export function filterUnitsBySearch(
  units: FlatOrganisationUnit[],
  query: string,
): Set<string> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return new Set(units.map((unit) => unit.id));
  }
  return new Set(
    units
      .filter(
        (unit) =>
          unit.name.toLowerCase().includes(trimmed) ||
          unit.code.toLowerCase().includes(trimmed),
      )
      .map((unit) => unit.id),
  );
}

export function nodeMatchesSearch(
  node: OrganisationUnitNode,
  matchingIds: ReadonlySet<string>,
): boolean {
  if (matchingIds.has(node.id)) {
    return true;
  }
  return node.children.some((child) => nodeMatchesSearch(child, matchingIds));
}
