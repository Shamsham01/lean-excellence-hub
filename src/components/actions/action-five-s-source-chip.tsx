import type { FiveSActionLineage } from "@/lib/actions/types";
import { AppLink } from "@/components/ui/app-link";

export function ActionFiveSSourceChip({
  lineage,
}: {
  lineage: FiveSActionLineage;
}) {
  return (
    <AppLink
      href={lineage.audit_href}
      className="inline-flex max-w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground hover:bg-muted"
      data-testid="action-five-s-source-chip"
    >
      <span className="truncate">{lineage.chip_label}</span>
    </AppLink>
  );
}
