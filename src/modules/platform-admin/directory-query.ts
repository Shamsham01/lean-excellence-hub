const STATUS_FILTERS = [
  "all",
  "provisioning",
  "active",
  "suspended",
  "closed",
  "attention",
] as const;

export type PlatformDirectoryStatus = (typeof STATUS_FILTERS)[number];

const PAGE_SIZE = 25;

export function parseDirectoryQuery(input: {
  page?: string | undefined;
  q?: string | undefined;
  status?: string | undefined;
}) {
  const search = (input.q ?? "").trim().slice(0, 80);
  const status = STATUS_FILTERS.includes(
    input.status as PlatformDirectoryStatus,
  )
    ? (input.status as PlatformDirectoryStatus)
    : "all";
  const parsedPage = Number(input.page);
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0 && parsedPage <= 401
      ? parsedPage
      : 1;

  return {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    page,
    search: search.length > 0 ? search : null,
    status,
  };
}

export function parseHistoryPage(page: string | undefined) {
  const parsedPage = Number(page);
  const safePage =
    Number.isInteger(parsedPage) && parsedPage > 0 && parsedPage <= 401
      ? parsedPage
      : 1;
  return {
    limit: PAGE_SIZE,
    offset: (safePage - 1) * PAGE_SIZE,
    page: safePage,
  };
}

const ORGANISATION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOrganisationId(value: string) {
  return ORGANISATION_ID.test(value);
}
