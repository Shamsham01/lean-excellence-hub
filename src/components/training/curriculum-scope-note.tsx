import { trainingCurriculumScopeMessage } from "@/modules/training/curriculum-admin";

export function TrainingCurriculumScopeNote({
  siteName,
}: {
  siteName?: string | null;
}) {
  return (
    <p
      className="text-sm text-muted-foreground"
      data-testid="training-curriculum-scope-note"
    >
      {trainingCurriculumScopeMessage(siteName)}
    </p>
  );
}
