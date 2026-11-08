export function TrainingTerminologyNote() {
  return (
    <section
      className="max-w-3xl rounded-lg border border-border bg-surface px-4 py-3 text-sm"
      data-testid="training-terminology"
    >
      <p className="font-medium">Training setup creates drafts only</p>
      <p
        className="mt-1 text-muted-foreground"
        data-testid="training-terminology-example"
      >
        Courses live in your catalogue. Curriculum assigns which job functions
        need which course. Completing training is not the same as Skills
        competence.
      </p>
    </section>
  );
}
