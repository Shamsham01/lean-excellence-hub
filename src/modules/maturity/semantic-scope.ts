export const MATURITY_ASSESSMENT_SCOPE_TYPES = [
  "site",
  "organisation",
  "department",
  "area",
] as const;

export type MaturityAssessmentScopeType =
  (typeof MATURITY_ASSESSMENT_SCOPE_TYPES)[number];

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
  if (ORGANISATION_UNIT_TYPES.has(normalised)) return "organisation";
  if (DEPARTMENT_UNIT_TYPES.has(normalised)) return "department";
  if (AREA_UNIT_TYPES.has(normalised)) return "area";
  return null;
}

export function scopeTypeLabel(scopeType: MaturityAssessmentScopeType): string {
  switch (scopeType) {
    case "site":
      return "Site";
    case "organisation":
      return "Organisation";
    case "department":
      return "Department";
    case "area":
      return "Area";
    default:
      return scopeType;
  }
}

export function defaultAssessmentScopes(): MaturityAssessmentScopeType[] {
  return ["site"];
}
