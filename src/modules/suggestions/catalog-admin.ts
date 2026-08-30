export type CatalogueStatusFilter = "active" | "deactivated" | "all";

export type ProgrammeLike = {
  id: string;
  name: string;
  code: string;
  status: string;
};

export type ProgrammeVersionLike = {
  programme_id: string;
  lifecycle: string;
};

export type CategoryLike = {
  id: string;
  name: string;
  code: string;
  status: string;
};

export type ProgrammeDisplayStatus = "draft" | "active" | "deactivated";

export function filterCatalogueByStatus<T extends { status: string }>(
  items: T[],
  filter: CatalogueStatusFilter,
): T[] {
  if (filter === "all") {
    return items;
  }

  if (filter === "active") {
    return items.filter((item) => item.status === "active");
  }

  return items.filter((item) => item.status === "deactivated");
}

export function filterCatalogueBySearch<
  T extends { name: string; code: string },
>(items: T[], query: string): T[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return items;
  }

  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(normalized) ||
      item.code.toLowerCase().includes(normalized),
  );
}

export function programmeHasPublishedHistory(
  versions: ProgrammeVersionLike[],
): boolean {
  return versions.some((version) => version.lifecycle !== "draft");
}

export function getProgrammeDisplayStatus(
  programme: ProgrammeLike,
  versions: ProgrammeVersionLike[],
): ProgrammeDisplayStatus {
  if (!programmeHasPublishedHistory(versions)) {
    return "draft";
  }

  return programme.status === "deactivated" ? "deactivated" : "active";
}

export function formatProgrammeDisplayStatus(status: ProgrammeDisplayStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "deactivated":
      return "Deactivated";
    default:
      return "Active";
  }
}

export function formatCategoryDisplayStatus(status: string) {
  return status === "deactivated" ? "Deactivated" : "Active";
}

export function programmeEmptyStateMessage(
  statusFilter: CatalogueStatusFilter,
  searchQuery: string,
): string {
  if (searchQuery.trim()) {
    return "No programmes match your search.";
  }

  if (statusFilter === "deactivated") {
    return "No deactivated programmes.";
  }

  if (statusFilter === "all") {
    return "No programmes configured yet.";
  }

  return "No active programmes yet.";
}

export function categoryEmptyStateMessage(
  statusFilter: CatalogueStatusFilter,
  searchQuery: string,
): string {
  if (searchQuery.trim()) {
    return "No categories match your search.";
  }

  if (statusFilter === "deactivated") {
    return "No deactivated categories.";
  }

  if (statusFilter === "all") {
    return "No categories configured yet.";
  }

  return "No active categories yet.";
}
