import type { Metadata } from "next";

import { AppLink } from "@/components/ui/app-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrganisationDirectoryTable } from "@/components/platform-admin/directory-table";
import { loadPlatformDirectory } from "@/modules/platform-admin/data";
import {
  parseDirectoryQuery,
  type PlatformDirectoryStatus,
} from "@/modules/platform-admin/directory-query";
import { resolvePlatformConsoleAccess } from "@/modules/platform-admin/gate";
import { readRequestPathname } from "@/platform/http/request-path";

export const metadata: Metadata = {
  title: "Organisations",
};

const FILTERS: Array<{ label: string; value: PlatformDirectoryStatus }> = [
  { label: "All", value: "all" },
  { label: "Provisioning", value: "provisioning" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Closed", value: "closed" },
  { label: "Needs attention", value: "attention" },
];

export default async function PlatformOrganisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const query = parseDirectoryQuery(await searchParams);
  const access = await resolvePlatformConsoleAccess();
  if (access.kind !== "allowed") {
    return null;
  }
  const directory = await loadPlatformDirectory({
    limit: query.limit,
    offset: query.offset,
    requestPath: await readRequestPathname(),
    search: query.search,
    status: query.status,
    userId: access.userId,
  });
  const pageCount = Math.max(1, Math.ceil(directory.total / directory.limit));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">Organisations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {directory.total} matching organisations. Verified customers are those
          with an operational Stripe subscription.
        </p>
      </div>
      <form
        action="/org_admin/organisations"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        method="get"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="organisation-search">Search</Label>
          <Input
            autoComplete="off"
            defaultValue={query.search ?? ""}
            id="organisation-search"
            maxLength={80}
            name="q"
            type="search"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="organisation-status">Status</Label>
          <select
            className="min-h-11 rounded-md border border-border bg-elevated px-3 text-sm"
            defaultValue={query.status}
            id="organisation-status"
            name="status"
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
        <button
          className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground"
          type="submit"
        >
          Search
        </button>
      </form>
      {directory.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No organisations match.</p>
      ) : (
        <OrganisationDirectoryTable rows={directory.rows} />
      )}
      <nav
        aria-label="Organisation pages"
        className="flex items-center gap-3 text-sm"
      >
        {query.page > 1 ? (
          <AppLink
            href={directoryHref(query.search, query.status, query.page - 1)}
          >
            Previous
          </AppLink>
        ) : (
          <span className="text-muted-foreground">Previous</span>
        )}
        <span className="tabular-nums">
          Page {query.page} of {pageCount}
        </span>
        {query.page < pageCount ? (
          <AppLink
            href={directoryHref(query.search, query.status, query.page + 1)}
          >
            Next
          </AppLink>
        ) : (
          <span className="text-muted-foreground">Next</span>
        )}
      </nav>
    </div>
  );
}

function directoryHref(
  search: string | null,
  status: PlatformDirectoryStatus,
  page: number,
) {
  const params = new URLSearchParams();
  if (search) {
    params.set("q", search);
  }
  if (status !== "all") {
    params.set("status", status);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query
    ? `/org_admin/organisations?${query}`
    : "/org_admin/organisations";
}
