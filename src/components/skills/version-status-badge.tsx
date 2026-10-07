import { Badge } from "@/components/ui/badge";

const labels: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
  active: "Active",
  deactivated: "Deactivated",
};

export function versionStatusLabel(status: string) {
  return labels[status] ?? status;
}

export function VersionStatusBadge({ status }: { status: string }) {
  const variant =
    status === "published" || status === "active"
      ? "success"
      : status === "archived" || status === "deactivated"
        ? "secondary"
        : "warning";

  return <Badge variant={variant}>{versionStatusLabel(status)}</Badge>;
}
