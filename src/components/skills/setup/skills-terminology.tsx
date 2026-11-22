export function SkillsTerminologyNote() {
  return (
    <aside
      className="max-w-3xl border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground"
      data-testid="skills-terminology"
    >
      <p>
        A <span className="text-foreground">job function</span> is the role
        someone performs, such as Line Operator. A{" "}
        <span className="text-foreground">skill</span> is an observable ability,
        such as Operate and monitor the oven. A{" "}
        <span className="text-foreground">proficiency scale</span> describes how
        capable that looks. A{" "}
        <span className="text-foreground">requirement</span> says which job
        function needs which skill, at what level, and where.
      </p>
      <p className="mt-2">
        An assessment is evidence for one person. Training is a learning
        activity. Completing training does not make someone competent, and not
        assessed is not a low score.
      </p>
      <p className="mt-2" data-testid="skills-terminology-example">
        Example: Oven Operators at Bodmin must demonstrate “Operate and monitor
        the oven” at Competent.
      </p>
    </aside>
  );
}
