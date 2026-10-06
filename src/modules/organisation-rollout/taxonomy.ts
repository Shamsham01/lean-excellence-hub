/**
 * Shared-standard vs site-local execution taxonomy for Lean Excellence Hub.
 *
 * This is the governance model we are moving toward. MULTISITE-EXPAND-01C
 * proves one vertical slice (Maturity) rather than changing every module.
 *
 * Access remains explicit RBAC. Organisation-wide visibility is never inferred
 * from job title, email domain, founder status after role changes, or
 * hierarchy position.
 */

export type StandardScope = "organisation_shared" | "site_local" | "mixed";

export type StandardTaxonomyRow = {
  domain: string;
  artefact: string;
  intendedScope: StandardScope;
  currentBehaviour: string;
  followUp: string | null;
};

export const SHARED_STANDARD_VS_SITE_EXECUTION: StandardTaxonomyRow[] = [
  {
    domain: "Maturity",
    artefact: "Frameworks / model versions",
    intendedScope: "organisation_shared",
    currentBehaviour:
      "organisation-owned catalogue; any authorised member with maturity.read can reuse the published framework",
    followUp: null,
  },
  {
    domain: "Maturity",
    artefact: "Assessments and results",
    intendedScope: "site_local",
    currentBehaviour:
      "unit-anchored with site_unit_id; sibling-site users cannot read another site's assessments",
    followUp: null,
  },
  {
    domain: "5S",
    artefact: "Standards / templates",
    intendedScope: "organisation_shared",
    currentBehaviour:
      "organisation-owned standards with multi-unit applicability",
    followUp: null,
  },
  {
    domain: "5S",
    artefact: "Audits",
    intendedScope: "site_local",
    currentBehaviour: "audits carry unit_id and site_unit_id",
    followUp: null,
  },
  {
    domain: "Gemba",
    artefact: "Definitions / templates",
    intendedScope: "organisation_shared",
    currentBehaviour:
      "organisation-owned definitions with multi-unit applicability",
    followUp: null,
  },
  {
    domain: "Gemba",
    artefact: "Walks",
    intendedScope: "site_local",
    currentBehaviour: "walks carry unit_id and site_unit_id",
    followUp: null,
  },
  {
    domain: "Training",
    artefact: "Courses / curricula",
    intendedScope: "organisation_shared",
    currentBehaviour:
      "organisation catalogue; applicability may be all / job function / unit",
    followUp:
      "Confirm unit-null sessions stay intentional for multi-site rollouts.",
  },
  {
    domain: "Training",
    artefact: "Sessions",
    intendedScope: "site_local",
    currentBehaviour:
      "sessions may be unit-null; site_unit_id is present when a unit is set",
    followUp:
      "Confirm unit-null sessions stay intentional for multi-site rollouts.",
  },
  {
    domain: "Skills",
    artefact: "Skill and capability definitions",
    intendedScope: "organisation_shared",
    currentBehaviour: "organisation-owned scales, skills, and capability sets",
    followUp: null,
  },
  {
    domain: "Skills",
    artefact: "Assessments / assignments",
    intendedScope: "site_local",
    currentBehaviour: "membership skill assessments carry site_unit_id",
    followUp: null,
  },
  {
    domain: "Suggestions",
    artefact: "Programmes / categories",
    intendedScope: "organisation_shared",
    currentBehaviour:
      "programmes are organisation-owned; a version has a single optional applicable unit",
    followUp:
      "Suggestion programme applicability is single-unit, unlike 5S/Gemba multi-unit maps.",
  },
  {
    domain: "Suggestions",
    artefact: "Ideas / workflow",
    intendedScope: "site_local",
    currentBehaviour: "suggestions carry origin/target units and site_unit_id",
    followUp: null,
  },
  {
    domain: "Actions",
    artefact: "Actions",
    intendedScope: "site_local",
    currentBehaviour:
      "unit_id is optional; site_unit_id is set when a unit exists",
    followUp: "Do not silently broaden unit-less actions across sites.",
  },
  {
    domain: "Projects",
    artefact: "Methodologies",
    intendedScope: "organisation_shared",
    currentBehaviour: "organisation-level methodologies",
    followUp: null,
  },
  {
    domain: "Projects",
    artefact: "CI projects",
    intendedScope: "site_local",
    currentBehaviour: "required unit_id and site_unit_id",
    followUp: null,
  },
  {
    domain: "Benefits",
    artefact: "Categories / settings",
    intendedScope: "organisation_shared",
    currentBehaviour: "organisation-level categories",
    followUp: null,
  },
  {
    domain: "Benefits",
    artefact: "Benefit records",
    intendedScope: "site_local",
    currentBehaviour: "organisational_unit_id and site_unit_id",
    followUp: null,
  },
];

export const PROVEN_VERTICAL_SLICE_DOMAIN = "Maturity";

export function taxonomyFollowUps(
  rows: readonly StandardTaxonomyRow[] = SHARED_STANDARD_VS_SITE_EXECUTION,
) {
  return rows.filter((row) => row.followUp !== null);
}
