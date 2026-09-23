import { trainingCatalogueScopeMessage } from "@/modules/training/catalog-admin";

export function TrainingCatalogueScopeNote({
  siteName,
}: {
  siteName?: string | null;
}) {
  return (
    <p
      className="text-sm text-muted-foreground"
      data-testid="training-catalogue-scope-note"
    >
      {trainingCatalogueScopeMessage(siteName)}
    </p>
  );
}
