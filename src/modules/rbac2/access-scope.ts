export type AccessScopeOption = {
  scope_type: string;
  scope_unit_id: string | null;
  label: string;
  unit_code?: string;
};

export type AccessScopeKind = "organisation" | "site";

export function accessScopeKey(scope: {
  scope_type: string;
  scope_unit_id: string | null;
}) {
  return `${scope.scope_type}::${scope.scope_unit_id ?? "null"}`;
}

export function parseAccessScopeKey(value: string) {
  const separator = value.indexOf("::");
  if (separator < 0) {
    return { scopeType: value, scopeUnitId: null as string | null };
  }
  const scopeType = value.slice(0, separator);
  const unitId = value.slice(separator + 2);
  return {
    scopeType,
    scopeUnitId: unitId === "null" || unitId === "" ? null : unitId,
  };
}

export function accessScopeKind(
  scopeType: string | null | undefined,
): AccessScopeKind | null {
  if (scopeType === "organisation") {
    return "organisation";
  }
  if (scopeType === "unit_subtree") {
    return "site";
  }
  return null;
}

function stripSubtreeSuffix(label: string) {
  return label.replace(/\s+subtree$/i, "").trim();
}

export function customerAccessScopeLabel(scope: AccessScopeOption) {
  if (scope.scope_type === "organisation") {
    return "Entire organisation";
  }
  if (scope.scope_type === "unit_subtree") {
    const name = stripSubtreeSuffix(scope.label);
    return name ? `Specific site: ${name}` : "Specific site";
  }
  return scope.label;
}

export function customerAccessScopeDescription(scopeType: string) {
  if (scopeType === "organisation") {
    return "Permitted work across all sites in this organisation, according to this role.";
  }
  if (scopeType === "unit_subtree") {
    return "Only this site, unless they are separately granted access elsewhere.";
  }
  return "Access is limited to the selected area.";
}

export function groupAccessScopeOptions(options: AccessScopeOption[]) {
  const organisation = options.filter(
    (scope) => scope.scope_type === "organisation",
  );
  const site = options.filter((scope) => scope.scope_type === "unit_subtree");
  const other = options.filter(
    (scope) =>
      scope.scope_type !== "organisation" &&
      scope.scope_type !== "unit_subtree",
  );
  return { organisation, site, other };
}

export function preferredSiteScopeKey(
  options: AccessScopeOption[],
  preferredSiteId: string | null | undefined,
) {
  if (!preferredSiteId) {
    return "";
  }
  const match = options.find(
    (scope) =>
      scope.scope_type === "unit_subtree" &&
      scope.scope_unit_id === preferredSiteId,
  );
  return match ? accessScopeKey(match) : "";
}
