export type AccessGrantScope = {
  scope_type: string;
  scope_unit_name?: string | null;
};

export function formatAccessScopeDisplay(grant: AccessGrantScope): string {
  if (grant.scope_type === "organisation") {
    return "Entire organisation";
  }

  if (grant.scope_type === "unit_subtree" && grant.scope_unit_name) {
    return `${grant.scope_unit_name} and its sub-areas`;
  }

  if (grant.scope_unit_name) {
    return grant.scope_unit_name;
  }

  return grant.scope_type;
}
