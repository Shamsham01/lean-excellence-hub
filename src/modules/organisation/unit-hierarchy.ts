export type OrganisationUnitNode = {
  id: string;
  code: string;
  name: string;
  unitType: string;
  parentUnitId: string | null;
  children: OrganisationUnitNode[];
};

export type FlatOrganisationUnit = {
  id: string;
  code: string;
  name: string;
  unit_type?: string;
  parent_unit_id?: string | null;
};

export function buildOrganisationUnitTree(
  units: FlatOrganisationUnit[],
): OrganisationUnitNode[] {
  const nodes = new Map<string, OrganisationUnitNode>();

  for (const unit of units) {
    nodes.set(unit.id, {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      unitType: unit.unit_type ?? "unit",
      parentUnitId: unit.parent_unit_id ?? null,
      children: [],
    });
  }

  const roots: OrganisationUnitNode[] = [];

  for (const node of nodes.values()) {
    if (node.parentUnitId && nodes.has(node.parentUnitId)) {
      nodes.get(node.parentUnitId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: OrganisationUnitNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
    for (const child of list) {
      sortNodes(child.children);
    }
  };

  sortNodes(roots);
  return roots;
}

export function formatUnitPath(
  unitId: string,
  units: FlatOrganisationUnit[],
): string {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const parts: string[] = [];
  let current = byId.get(unitId);

  while (current) {
    parts.unshift(current.name);
    current = current.parent_unit_id
      ? byId.get(current.parent_unit_id)
      : undefined;
  }

  return parts.join(" › ");
}
