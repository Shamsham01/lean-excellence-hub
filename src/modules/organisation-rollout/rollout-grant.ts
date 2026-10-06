/**
 * Roll-out-another-site leadership grants stay site-scoped.
 * Organisation-wide access must be granted explicitly from People.
 */
export function rolloutGrantScopeError(input: {
  siteId: string;
  scopeType: string;
  scopeUnitId: string | null;
}): string | null {
  if (
    input.scopeType === "unit_subtree" &&
    input.scopeUnitId === input.siteId
  ) {
    return null;
  }

  if (input.scopeType === "organisation") {
    return "Roll out another site grants access for this site only. Use People to grant organisation-wide access.";
  }

  return "Choose access for the site you are rolling out.";
}
