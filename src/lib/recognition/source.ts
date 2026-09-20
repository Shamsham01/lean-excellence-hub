export function recognitionSourceHref(
  resourceType: string | null | undefined,
  resourceId: string,
): string | null {
  switch (resourceType) {
    case "improvement_suggestion":
      return `/platform/suggestions/${resourceId}`;
    case "ci_project":
      return `/platform/projects/${resourceId}`;
    case "action":
      return `/platform/actions/${resourceId}`;
    default:
      return null;
  }
}

export function recognitionSourceOpenLabel(
  resourceType: string | null | undefined,
  title: string | null | undefined,
): string {
  const name = title?.trim();
  if (name) return `Open ${name}`;

  switch (resourceType) {
    case "improvement_suggestion":
      return "Open suggestion";
    case "ci_project":
      return "Open project";
    case "action":
      return "Open action";
    default:
      return "Open source";
  }
}
