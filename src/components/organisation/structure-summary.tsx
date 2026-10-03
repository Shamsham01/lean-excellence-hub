import type { OrganisationStructureSummary } from "@/modules/organisation/unit-hierarchy";

export function StructureSummary({
  summary,
}: {
  summary: OrganisationStructureSummary;
}) {
  const tiles = [
    { label: "Active units", value: summary.activeUnits },
    { label: "Top-level units", value: summary.topLevelUnits },
    { label: "Archived units", value: summary.archivedUnits },
    { label: "Maximum depth", value: summary.maxDepth },
  ];

  return (
    <dl
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      data-testid="structure-summary"
    >
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-md border border-border/70 bg-surface px-3 py-2"
        >
          <dt className="text-xs text-muted-foreground">{tile.label}</dt>
          <dd
            className="text-lg font-semibold tracking-tight text-foreground"
            data-testid={`structure-summary-${tile.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
