import type {
  ProjectLinkSummary,
  ProjectSelectorOption,
} from "@/lib/projects/types";

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
      id: projectId,
      project_number: projectId.slice(0, 8),
      title: "Linked project",
      status: "unknown",
      href: `/platform/projects/${projectId}`,
      can_open: true,
    };
  }
  return projectLinkSummaryFromOption(option);
}
