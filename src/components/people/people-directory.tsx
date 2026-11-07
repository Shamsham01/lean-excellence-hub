import { PlatformMemberAvatar } from "@/components/platform/platform-member-avatar";
import { MembershipStatusPill } from "@/components/people/membership-status-pill";
import { PeopleDirectoryRowActions } from "@/components/people/people-directory-row-actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatLongDate } from "@/lib/dates/format-long-date";
import {
  hasActivePeopleDirectoryFilters,
  PEOPLE_DIRECTORY_PAGE_SIZES,
  peopleDirectoryHref,
  type PeopleDirectoryFilters,
} from "@/lib/people/directory-query";
import {
  peopleDirectoryContactLine,
  peopleDirectoryRoleLabel,
} from "@/lib/people/membership-status";
import type {
  PeopleDirectoryPerson,
  PeopleDirectoryUnitOption,
} from "@/lib/people/directory-types";
type PeopleDirectoryProps = {
  people: PeopleDirectoryPerson[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: PeopleDirectoryFilters;
  units: PeopleDirectoryUnitOption[];
  canManageMemberships: boolean;
  canIncludeInactive: boolean;
};

const CLEAR_FILTERS_HREF = peopleDirectoryHref({});

function formatJoinedDate(value: string | null): string {
  if (!value) return "—";
  return formatLongDate(value);
}

function formatUnitLabel(person: PeopleDirectoryPerson): string {
  if (!person.primary_unit_name) return "—";
  if (person.primary_unit_code) {
    return `${person.primary_unit_code} — ${person.primary_unit_name}`;
  }
  return person.primary_unit_name;
}

function DirectoryPagination({
  filters,
  totalCount,
  page,
  pageSize,
}: {
  filters: PeopleDirectoryFilters;
  totalCount: number;
  page: number;
  pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const previousHref = peopleDirectoryHref({
    ...filters,
    page: page - 1,
    pageSize,
  });
  const nextHref = peopleDirectoryHref({
    ...filters,
    page: page + 1,
    pageSize,
  });

  return (
    <div
      className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid="people-directory-pagination"
    >
      <p className="text-sm text-muted-foreground">
        {totalCount === 0
          ? "No people to show"
          : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          asChild
          disabled={page <= 1}
        >
          <AppLink
            href={previousHref}
            aria-label="Previous page"
            data-testid="people-directory-previous-page"
            aria-disabled={page <= 1 ? true : undefined}
            className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
          >
            Previous
          </AppLink>
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          asChild
          disabled={page >= totalPages}
        >
          <AppLink
            href={nextHref}
            aria-label="Next page"
            data-testid="people-directory-next-page"
            aria-disabled={page >= totalPages ? true : undefined}
            className={
              page >= totalPages ? "pointer-events-none opacity-50" : undefined
            }
          >
            Next
          </AppLink>
        </Button>
      </div>
    </div>
  );
}

function DirectoryUserCell({ person }: { person: PeopleDirectoryPerson }) {
  const displayName = person.display_name?.trim() || "Unnamed member";
  const contactLine = peopleDirectoryContactLine(person);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <PlatformMemberAvatar
        displayName={displayName}
        avatarUrl={person.avatar_url}
        size="sm"
      />
      <div className="min-w-0">
        <AppLink
          href={`/platform/people/${person.membership_id}`}
          className="block truncate font-medium text-foreground hover:underline"
          data-testid={`people-directory-link-${person.membership_id}`}
        >
          {displayName}
        </AppLink>
        <p className="truncate text-sm text-muted-foreground">{contactLine}</p>
      </div>
    </div>
  );
}

function DirectoryMobileCard({
  person,
  canManageMemberships,
}: {
  person: PeopleDirectoryPerson;
  canManageMemberships: boolean;
}) {
  const displayName = person.display_name?.trim() || "Unnamed member";

  return (
    <article
      className="rounded-lg border border-border bg-card p-4 shadow-xs"
      data-testid={`people-directory-mobile-card-${person.membership_id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <DirectoryUserCell person={person} />
        <PeopleDirectoryRowActions
          membershipId={person.membership_id}
          displayName={displayName}
          canManage={canManageMemberships}
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Department / unit</dt>
          <dd className="font-medium">{formatUnitLabel(person)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium">{peopleDirectoryRoleLabel(person)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <MembershipStatusPill status={person.status} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Joined</dt>
          <dd className="font-medium">{formatJoinedDate(person.joined_at)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function PeopleDirectory({
  people,
  totalCount,
  page,
  pageSize,
  filters,
  units,
  canManageMemberships,
  canIncludeInactive,
}: PeopleDirectoryProps) {
  const filteredEmpty =
    people.length === 0 && hasActivePeopleDirectoryFilters(filters);

  return (
    <Card data-testid="people-directory-card">
      <CardHeader className="gap-4 border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl font-semibold tracking-tight">
            People
          </CardTitle>
          <CardDescription>
            Workforce directory — search colleagues, filter by unit and
            membership status, and open profiles or administration.
          </CardDescription>
        </div>

        <form
          method="get"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
          data-testid="people-directory-filters"
        >
          <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-2">
            <span className="text-muted-foreground">Search</span>
            <Input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Search by name or email"
              className="min-h-11"
              data-testid="people-directory-search"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Department / unit</span>
            <select
              name="unit"
              defaultValue={filters.unitId ?? ""}
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              data-testid="people-directory-unit-filter"
            >
              <option value="">All units</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} — {unit.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Status</span>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              data-testid="people-directory-status-filter"
            >
              <option value="">Active members</option>
              <option value="all">All visible statuses</option>
              <option value="active">Active</option>
              <option value="pending">Invited / onboarding</option>
              {canIncludeInactive ? (
                <option value="inactive">Inactive</option>
              ) : null}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Page size</span>
            <select
              name="pageSize"
              defaultValue={String(pageSize)}
              className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              data-testid="people-directory-page-size"
            >
              {PEOPLE_DIRECTORY_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          {canIncludeInactive ? (
            <label className="flex min-h-11 items-end gap-2 text-sm">
              <input
                type="checkbox"
                name="includeInactive"
                value="1"
                defaultChecked={filters.includeInactive}
                className="border-input size-4 rounded border"
                data-testid="people-directory-include-inactive"
              />
              <span>Include inactive in default view</span>
            </label>
          ) : null}

          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-5">
            <Button
              type="submit"
              variant="default"
              className="min-h-11"
              data-testid="people-directory-apply-filters"
            >
              Apply
            </Button>
            {hasActivePeopleDirectoryFilters(filters) ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                asChild
                data-testid="people-directory-clear-filters"
              >
                <AppLink href={CLEAR_FILTERS_HREF}>Clear filters</AppLink>
              </Button>
            ) : null}
          </div>
        </form>
      </CardHeader>

      <CardContent className="pt-4">
        {people.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-border px-4 py-10 text-center"
            data-testid="people-directory-empty"
          >
            <p className="text-sm font-medium">
              {filteredEmpty
                ? "No people match these filters."
                : "No people found."}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table
                className="w-full min-w-[880px] border-collapse text-left text-sm"
                data-testid="people-directory-table"
              >
                <thead>
                  <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                    <th scope="col" className="px-3 py-3 font-medium">
                      User
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Department / unit
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Role / job function
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3 font-medium">
                      Joined
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-right font-medium"
                    >
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => {
                    const displayName =
                      person.display_name?.trim() || "Unnamed member";
                    return (
                      <tr
                        key={person.membership_id}
                        className="border-b border-border/80 last:border-b-0"
                        data-testid={`people-directory-row-${person.membership_id}`}
                      >
                        <td className="px-3 py-3">
                          <DirectoryUserCell person={person} />
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {formatUnitLabel(person)}
                        </td>
                        <td className="px-3 py-3">
                          {peopleDirectoryRoleLabel(person)}
                        </td>
                        <td className="px-3 py-3">
                          <MembershipStatusPill status={person.status} />
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {formatJoinedDate(person.joined_at)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <PeopleDirectoryRowActions
                            membershipId={person.membership_id}
                            displayName={displayName}
                            canManage={canManageMemberships}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {people.map((person) => (
                <DirectoryMobileCard
                  key={person.membership_id}
                  person={person}
                  canManageMemberships={canManageMemberships}
                />
              ))}
            </div>

            <DirectoryPagination
              filters={filters}
              totalCount={totalCount}
              page={page}
              pageSize={pageSize}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
