import type { ProblemSolvingSourceLinkSummary } from "@/lib/problem-solving/types";

export function problemSolvingSourceHref(
  link: ProblemSolvingSourceLinkSummary,
): string | null {
  switch (link.resource_type) {
    case "ci_project":
      return `/platform/projects/${link.source_resource_id}`;
    case "improvement_suggestion":
      return `/platform/suggestions/${link.source_resource_id}`;
    default:
      return null;
  }
}
