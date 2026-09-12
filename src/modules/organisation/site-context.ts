import { isSiteUnitType } from "@/modules/organisation/site-semantics";
import {
  filterUnitsToSite,
  type FlatOrganisationUnit,
} from "@/modules/organisation/unit-hierarchy";

export const ACTIVE_SITE_COOKIE = "leanhub-active-site";
export const ALL_SITES_COOKIE_VALUE = "all";

const OPAQUE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_HEX_PATTERN = /^[0-9a-f]{8}$/i;

export type AccessibleSite = {
  id: string;
  name: string;
  code: string;
};

export type ActiveSiteMode = "legacy" | "all" | "site";

export type ActiveSiteContext = {
  mode: ActiveSiteMode;
  activeSiteId: string | null;
  locked: boolean;
  sites: AccessibleSite[];
};

export type SelectablePerson = {
  id: string;
  displayName: string;
  jobTitle: string | null;
  jobFunctionName: string | null;
  unitName: string | null;
  placementUnitId: string | null;
};

export type PersonSelectOption = {
  id: string;
  label: string;
  name: string;
  placementUnitId: string | null;
};

export type UnitSelectOption = {
  id: string;
  name: string;
};

export function listAccessibleSites(
  units: FlatOrganisationUnit[],
): AccessibleSite[] {
  return units
    .filter((unit) => isSiteUnitType(unit.unit_type))
    .map((unit) => ({
      id: unit.id,
      name: unit.name,
      code: unit.code,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en-GB"));
}

/**
 * Resolve the UX active-site context from accessible (RLS-visible) sites and
 * an untrusted cookie/request value. The result never grants extra sites.
 */
export function resolveActiveSiteContext(
  sites: AccessibleSite[],
  requestedSiteId: string | null | undefined,
): ActiveSiteContext {
  if (sites.length === 0) {
    return {
      mode: "legacy",
      activeSiteId: null,
      locked: true,
      sites,
    };
  }

  if (sites.length === 1) {
    const onlySite = sites[0]!;
    return {
      mode: "site",
      activeSiteId: onlySite.id,
      locked: true,
      sites,
    };
  }

  if (
    !requestedSiteId ||
    requestedSiteId === ALL_SITES_COOKIE_VALUE ||
    requestedSiteId.trim() === ""
  ) {
    return {
      mode: "all",
      activeSiteId: null,
      locked: false,
      sites,
    };
  }

  const matched = sites.find((site) => site.id === requestedSiteId);
  if (!matched) {
    return {
      mode: "all",
      activeSiteId: null,
      locked: false,
      sites,
    };
  }

  return {
    mode: "site",
    activeSiteId: matched.id,
    locked: false,
    sites,
  };
}

export function filterUnitsForActiveSite(
  units: FlatOrganisationUnit[],
  context: ActiveSiteContext,
  options: { requireConcreteSite?: boolean } = {},
): FlatOrganisationUnit[] {
  const requireConcreteSite = options.requireConcreteSite === true;

  if (context.mode === "legacy") {
    return units;
  }

  if (context.mode === "all") {
    return requireConcreteSite ? [] : units;
  }

  if (!context.activeSiteId) {
    return requireConcreteSite ? [] : units;
  }

  return filterUnitsToSite(units, context.activeSiteId);
}

export function buildSiteScopedUnitOptions(
  units: FlatOrganisationUnit[],
  context: ActiveSiteContext,
  options: { requireConcreteSite?: boolean } = {},
): { units: UnitSelectOption[]; requiresSiteSelection: boolean } {
  const requireConcreteSite = options.requireConcreteSite === true;
  return {
    units: filterUnitsForActiveSite(units, context, {
      requireConcreteSite,
    }).map(toUnitSelectOption),
    requiresSiteSelection: requireConcreteSite && context.mode === "all",
  };
}

export function filterUnitOptionsByIds(
  options: UnitSelectOption[],
  allowedIds: ReadonlySet<string>,
): UnitSelectOption[] {
  return options.filter((option) => allowedIds.has(option.id));
}

/**
 * Compose RLS-visible units → active-site UX filter → exact-unit applicability.
 * Active site remains UX context only; allowedIds never enlarge the candidate set.
 */
export function buildApplicableSiteScopedUnitOptions(
  units: FlatOrganisationUnit[],
  context: ActiveSiteContext,
  applicableIds: ReadonlySet<string>,
  options: { requireConcreteSite?: boolean } = {},
): { units: UnitSelectOption[]; requiresSiteSelection: boolean } {
  const scoped = buildSiteScopedUnitOptions(units, context, options);
  return {
    requiresSiteSelection: scoped.requiresSiteSelection,
    units: filterUnitOptionsByIds(scoped.units, applicableIds),
  };
}

export function filterPeopleForActiveSite(
  people: SelectablePerson[],
  context: ActiveSiteContext,
  visibleUnitIds: Set<string>,
  options: { requireConcreteSite?: boolean } = {},
): SelectablePerson[] {
  const requireConcreteSite = options.requireConcreteSite === true;

  if (context.mode === "all" && requireConcreteSite) {
    return [];
  }

  if (context.mode !== "site") {
    return people;
  }

  return people.filter((person) => {
    if (!person.placementUnitId) {
      return true;
    }
    return visibleUnitIds.has(person.placementUnitId);
  });
}

export function isLikelyOpaqueId(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  return OPAQUE_ID_PATTERN.test(trimmed) || SHORT_HEX_PATTERN.test(trimmed);
}

export function resolvePersonDisplayName(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && !isLikelyOpaqueId(trimmed)) {
      return trimmed;
    }
  }
  return "Colleague";
}

export function formatPersonOptionLabel(person: {
  displayName: string;
  jobFunctionName?: string | null;
  jobTitle?: string | null;
  unitName?: string | null;
}): string {
  const role = person.jobFunctionName ?? person.jobTitle;
  const context = [role, person.unitName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part && part.length > 0))
    .filter((part) => part !== person.displayName);

  if (context.length === 0) {
    return person.displayName;
  }

  return `${person.displayName} (${context.join(" · ")})`;
}

export function toPersonSelectOption(
  person: SelectablePerson,
): PersonSelectOption {
  return {
    id: person.id,
    name: person.displayName,
    label: formatPersonOptionLabel(person),
    placementUnitId: person.placementUnitId,
  };
}

export function toUnitSelectOption(
  unit: FlatOrganisationUnit,
): UnitSelectOption {
  return { id: unit.id, name: unit.name };
}

/**
 * Resolve the next controlled selector value without substituting a different
 * record. Invalid/stale values clear. An exactly-one-candidate set may be
 * selected only when the current value is empty.
 */
export function nextSelectorValue(input: {
  options: ReadonlyArray<{ id: string }>;
  value: string;
  allowEmpty?: boolean;
}): string {
  if (input.options.some((option) => option.id === input.value)) {
    return input.value;
  }

  if (input.allowEmpty || input.value) {
    return "";
  }

  if (input.options.length === 1) {
    return input.options[0]!.id;
  }

  return "";
}

export function resolveSelectorValue(
  options: ReadonlyArray<{ id: string }>,
  preferred?: string | null,
): string {
  return nextSelectorValue({
    options,
    value: preferred ?? "",
  });
}

export function isSelectorPreferredValueMissing(
  options: ReadonlyArray<{ id: string }>,
  preferred?: string | null,
): boolean {
  return Boolean(
    preferred && !options.some((option) => option.id === preferred),
  );
}

export function requireSelectableMemberships<T>(result: {
  data: T[] | null;
  error: unknown;
}): T[] {
  if (result.error) {
    throw new Error("Unable to load organisation memberships.");
  }

  return result.data ?? [];
}

export function mergeSelectablePeople(input: {
  memberships: Array<{
    id: string;
    display_name: string | null;
    job_title: string | null;
  }>;
  directoryPeople?: Array<{
    membership_id: string;
    display_name: string | null;
    job_title?: string | null;
    job_function_name?: string | null;
  }>;
  assignments?: Array<{
    membership_id: string;
    job_function_name_snapshot: string | null;
    organisational_unit_id: string | null;
  }>;
  units?: FlatOrganisationUnit[];
}): SelectablePerson[] {
  const unitNameById = new Map(
    (input.units ?? []).map((unit) => [unit.id, unit.name]),
  );
  const directoryById = new Map(
    (input.directoryPeople ?? []).map((person) => [
      person.membership_id,
      person,
    ]),
  );
  const assignmentByMembershipId = new Map(
    (input.assignments ?? []).map((assignment) => [
      assignment.membership_id,
      assignment,
    ]),
  );

  const people: SelectablePerson[] = [];

  for (const membership of input.memberships) {
    const directory = directoryById.get(membership.id);
    const assignment = assignmentByMembershipId.get(membership.id);
    const placementUnitId = assignment?.organisational_unit_id ?? null;

    people.push({
      id: membership.id,
      displayName: resolvePersonDisplayName(
        directory?.display_name,
        membership.display_name,
        directory?.job_function_name,
        assignment?.job_function_name_snapshot,
        membership.job_title,
      ),
      jobTitle: directory?.job_title ?? membership.job_title ?? null,
      jobFunctionName:
        directory?.job_function_name ??
        assignment?.job_function_name_snapshot ??
        null,
      unitName: placementUnitId
        ? (unitNameById.get(placementUnitId) ?? null)
        : null,
      placementUnitId,
    });
  }

  return people.sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "en-GB"),
  );
}
