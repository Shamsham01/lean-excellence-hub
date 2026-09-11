/**
 * Site semantic types match the database normalisation used by the site
 * security boundary (`private.normalise_organisation_unit_semantic_scope`).
 * This list is presentation/filtering only; it is not an authorisation source.
 */
const SITE_UNIT_TYPES = new Set([
  "site",
  "plant",
  "facility",
  "factory",
  "location",
]);

export function isSiteUnitType(unitType: string | null | undefined): boolean {
  if (!unitType) {
    return false;
  }
  return SITE_UNIT_TYPES.has(unitType.trim().toLowerCase());
}
