export const PEOPLE_DIRECTORY_DEFAULT_PAGE_SIZE = 25;
export const PEOPLE_DIRECTORY_PAGE_SIZES = [10, 25, 50] as const;

export type PeopleDirectoryStatusFilter =
  "all" | "active" | "pending" | "inactive";

export type PeopleDirectoryFilters = {
  q: string | null;
  unitId: string | null;
  status: PeopleDirectoryStatusFilter | null;
  page: number;
  pageSize: number;
  includeInactive: boolean;
};

export type RawPeopleDirectorySearchParams = Record<
  string,
  string | string[] | undefined
>;

function readParam(
  params: RawPeopleDirectorySearchParams,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizePageSize(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (
    PEOPLE_DIRECTORY_PAGE_SIZES.includes(
      parsed as (typeof PEOPLE_DIRECTORY_PAGE_SIZES)[number],
    )
  ) {
    return parsed;
  }
  return PEOPLE_DIRECTORY_DEFAULT_PAGE_SIZE;
}

function normalizeSearch(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeUuid(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^[0-9a-f-]{36}$/i.test(trimmed) ? trimmed : null;
}

function normalizeStatus(
  value: string | undefined,
): PeopleDirectoryStatusFilter | null {
  switch (value) {
    case "all":
    case "active":
    case "pending":
    case "inactive":
      return value;
    default:
      return null;
  }
}

export function parsePeopleDirectorySearchParams(
  params: RawPeopleDirectorySearchParams,
): PeopleDirectoryFilters {
  return {
    q: normalizeSearch(readParam(params, "q")),
    unitId: normalizeUuid(readParam(params, "unit")),
    status: normalizeStatus(readParam(params, "status")),
    page: normalizePage(readParam(params, "page")),
    pageSize: normalizePageSize(readParam(params, "pageSize")),
    includeInactive: readParam(params, "includeInactive") === "1",
  };
}

export function buildPeopleDirectorySearchParams(
  filters: Partial<PeopleDirectoryFilters>,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.unitId) params.set("unit", filters.unitId);
  if (filters.status) params.set("status", filters.status);
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }
  if (
    filters.pageSize &&
    filters.pageSize !== PEOPLE_DIRECTORY_DEFAULT_PAGE_SIZE
  ) {
    params.set("pageSize", String(filters.pageSize));
  }
  if (filters.includeInactive) params.set("includeInactive", "1");
  return params;
}

export function peopleDirectoryHref(
  filters: Partial<PeopleDirectoryFilters>,
): string {
  const query = buildPeopleDirectorySearchParams(filters).toString();
  return query ? `/platform/people?${query}` : "/platform/people";
}

export function hasActivePeopleDirectoryFilters(
  filters: PeopleDirectoryFilters,
): boolean {
  return Boolean(
    filters.q || filters.unitId || filters.status || filters.includeInactive,
  );
}
