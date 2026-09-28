import {
  FORMAL_LIFECYCLE_STEPS,
  formalLifecycleIndex,
} from "@/modules/maturity/formal-lifecycle";

export function FormalLifecycleIndicator({ status }: { status: string }) {
  const currentIndex = formalLifecycleIndex(status);

  return (
    <ol
      className="flex flex-wrap items-center gap-1 text-xs"
      data-testid="formal-lifecycle-indicator"
    >
      {FORMAL_LIFECYCLE_STEPS.map((step, index) => {
        const isCurrent =
          step.id === status || (status === "in_progress" && index === 0);
        const isComplete = index < currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-1">
            {index > 0 ? (
              <span className="text-muted-foreground" aria-hidden>
                →
              </span>
            ) : null}
            <span
              className={
                isCurrent
                  ? "rounded-full bg-accent px-2 py-1 font-semibold text-accent-foreground"
                  : isComplete
                    ? "rounded-full bg-muted px-2 py-1 text-foreground"
                    : "rounded-full px-2 py-1 text-muted-foreground"
              }
              data-current={isCurrent ? "true" : "false"}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
