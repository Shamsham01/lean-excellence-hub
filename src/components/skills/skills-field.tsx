export const skillsControlClass =
  "flex min-h-11 w-full min-w-0 rounded-md border border-border bg-elevated px-3 text-sm text-foreground";

export function SkillsFieldError({
  id,
  testId,
  children,
}: {
  id?: string;
  testId?: string;
  children: string;
}) {
  return (
    <p
      id={id}
      role="alert"
      className="text-sm text-destructive"
      data-testid={testId}
    >
      {children}
    </p>
  );
}
