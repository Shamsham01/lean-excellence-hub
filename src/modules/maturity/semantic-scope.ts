export const MATURITY_FRAMEWORK_SCOPE_TYPES = [
  "site",
  "department",
  "area",
] as const;

export type MaturityFrameworkScopeType =
  (typeof MATURITY_FRAMEWORK_SCOPE_TYPES)[number];

/** Selectable scopes for new assessments and framework configuration. */
export const MATURITY_ASSESSMENT_SCOPE_TYPES = MATURITY_FRAMEWORK_SCOPE_TYPES;

export type MaturityAssessmentScopeType = MaturityFrameworkScopeType;

export const MATURITY_HISTORICAL_ASSESSMENT_SCOPE_TYPES = [
  "organisation",
  "legacy_unit",
] as const;

export type MaturityHistoricalAssessmentScopeType =
  (typeof MATURITY_HISTORICAL_ASSESSMENT_SCOPE_TYPES)[number];

const SITE_UNIT_TYPES = new Set([
  "site",
  "plant",
  "facility",
  "factory",
  "location",
]);

const ORGANISATION_UNIT_TYPES = new Set([
  "organisation",
  "organization",
  "org",
  "company",
  "enterprise",
  "group",
]);

const DEPARTMENT_UNIT_TYPES = new Set(["department", "dept", "division"]);

const AREA_UNIT_TYPES = new Set(["area", "zone", "section", "cell"]);

export function normaliseUnitTypeToSemanticScope(
  unitType: string,
): MaturityAssessmentScopeType | null {
  const normalised = unitType.trim().toLowerCase();
  if (SITE_UNIT_TYPES.has(normalised)) return "site";
  if (DEPARTMENT_UNIT_TYPES.has(normalised)) return "department";
  if (AREA_UNIT_TYPES.has(normalised)) return "area";
  return null;
}

export function isHistoricalAssessmentScopeType(
  scopeType: string,
): scopeType is MaturityHistoricalAssessmentScopeType {
  return (
    scopeType === "organisation" ||
    scopeType === "legacy_unit" ||
    ORGANISATION_UNIT_TYPES.has(scopeType)
  );
}

export function scopeTypeLabel(scopeType: string): string {
  switch (scopeType) {
    case "site":
      return "Site";
    case "organisation":
      return "Organisation (historical)";
    case "department":
      return "Department";
    case "area":
      return "Area";
    case "legacy_unit":
      return "Legacy unit (historical)";
    default:
      return scopeType;
  }
}

export function defaultAssessmentScopes(): MaturityAssessmentScopeType[] {
  return ["site"];
}
