import type { StructureGuidance } from "@/modules/organisation-onboarding";

export function StructureFirstGuidance({
  items,
}: {
  items: readonly StructureGuidance[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <aside
      className="rounded-lg border border-border bg-surface px-4 py-3"
      data-testid="structure-first-guidance"
      aria-label="Setup guidance"
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Advisory guidance
      </p>
      <ul className="mt-2 flex flex-col gap-2 text-sm text-foreground">
        {items.map((item) => (
          <li key={item.id}>{item.body}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        This is advisory. LeanAI does not determine the correct structure for
        your organisation.
      </p>
    </aside>
  );
}
