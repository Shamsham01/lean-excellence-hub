const FLOW_STEPS = [
  {
    module: "Gemba",
    status: "Observation identified",
    detail: "Packing cell · today",
  },
  {
    module: "Action",
    status: "Owner assigned",
    detail: "Area leader · due Friday",
  },
  {
    module: "Problem Solving",
    status: "Root cause verified",
    detail: "Containment in place",
  },
  {
    module: "Project",
    status: "Countermeasure implemented",
    detail: "Standard updated",
  },
  {
    module: "Benefit",
    status: "Awaiting validation",
    detail: "Forecast captured · not customer results",
  },
] as const;

export function MarketingSystemVisual() {
  return (
    <figure className="marketing-system">
      <div className="marketing-system-shell marketing-system-shell-hero">
        <div className="marketing-system-chrome">
          <div className="marketing-system-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="truncate text-xs font-medium tracking-wide text-muted-foreground">
            From signal to measurable improvement
          </p>
        </div>
        <div className="marketing-system-body">
          <ol className="marketing-system-flow" role="list">
            {FLOW_STEPS.map((step) => (
              <li key={step.module}>
                <div className="marketing-system-card">
                  <p className="text-[0.68rem] font-semibold tracking-[0.1em] whitespace-nowrap text-muted-foreground uppercase">
                    {step.module}
                  </p>
                  <p className="mt-1 text-sm font-semibold tracking-tight text-foreground">
                    {step.status}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <aside className="marketing-maturity-panel">
            <div>
              <p className="text-[0.68rem] font-semibold tracking-[0.1em] whitespace-nowrap text-accent-foreground uppercase">
                Maturity
              </p>
              <p className="mt-2 text-sm font-semibold tracking-tight text-foreground">
                Connecting layer
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Evidence from Gemba, actions and projects sits in the same
                operating system — not a separate scorecard.
              </p>
            </div>
            <p className="text-xs font-medium text-accent-foreground">
              Engine, not doctrine
            </p>
          </aside>
        </div>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">
        A workplace signal becoming owned action, a verified countermeasure and
        a benefit awaiting validation.
      </figcaption>
    </figure>
  );
}
