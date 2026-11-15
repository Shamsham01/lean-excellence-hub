import type {
  ProjectLinkSummary,
  ProjectSelectorOption,
} from "@/lib/projects/types";

export function projectLinkSummaryFromServer(
  raw: unknown,
): ProjectLinkSummary | null {
  if (raw == null) return null;
  if (typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.linked === true && record.can_open === false) {
    return {
      linked: true,
      can_open: false,
      title: "Linked project (not available here)",
    };
  }
  if (typeof record.id !== "string") return null;
  return {
    id: record.id,
    project_number:
      typeof record.project_number === "string" ? record.project_number : "",
    title: typeof record.title === "string" ? record.title : "Linked project",
    status: typeof record.status === "string" ? record.status : "unknown",
    href:
      typeof record.href === "string"
        ? record.href
        : `/platform/projects/${record.id}`,
    can_open: record.can_open !== false,
  };
}

export function projectLinkSummaryFromOption(
  option: ProjectSelectorOption,
): ProjectLinkSummary {
  return {
    id: option.id,
    project_number: option.project_number,
    title: option.title,
    status: option.status,
    href: `/platform/projects/${option.id}`,
    can_open: true,
  };
}

export function resolveProjectLinkSummary(
  projectId: string | null | undefined,
  options: ProjectSelectorOption[],
  fallback?: ProjectLinkSummary | null,
): ProjectLinkSummary | null {
  if (fallback) return fallback;
  if (!projectId) return null;
  const option = options.find((row) => row.id === projectId);
  if (!option) {
    return {
      linked: true,
      can_open: false,
      title: "Linked project (not available here)",
    };
  }
  return projectLinkSummaryFromOption(option);
}
