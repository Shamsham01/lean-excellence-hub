import {
  MarketingContainer,
  MarketingSection,
  PreviewCaption,
  SectionIntro,
  StatusChip,
} from "./primitives";

const STEPS = [
  {
    title: "Observe",
    record: "Gemba · Packing cell",
    body: "Label station missing at point of use.",
    meta: "Finding · today",
  },
  {
    title: "Act",
    record: "ACT-1042",
    body: "Restore point-of-use labels before Friday.",
    meta: "Area leader · Open · due Friday",
  },
  {
    title: "Solve",
    record: "Problem solving",
    body: "Why did the standard drift after the last changeover?",
    meta: "Root cause analysis · in progress",
  },
  {
    title: "Improve",
    record: "Project · standard update",
    body: "Countermeasure implemented on the line.",
    meta: "Benefit forecast captured · awaiting validation",
  },
  {
    title: "Learn",
    record: "Capability + maturity",
    body: "The organisation keeps the evidence, the method and the skill.",
    meta: "Connecting layer · not a separate scorecard",
  },
] as const;

export function MarketingJourney() {
  return (
    <MarketingSection id="impact" className="marketing-process-section">
      <MarketingContainer wide>
        <SectionIntro
          kicker="From evidence to impact"
          title="A connected loop, not a pile of modules."
        >
          <p>
            Frontline evidence becomes owned work, structured solving, delivered
            improvement and organisational learning — with maturity as the
            connecting layer.
          </p>
        </SectionIntro>

        <figure className="marketing-process">
          <div className="marketing-process-progress" aria-hidden="true" />
          <ol className="marketing-process-track" role="list">
            {STEPS.map((step, index) => (
              <li key={step.title} className="marketing-process-step">
                <p className="marketing-process-index">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="marketing-subheading mt-3">{step.title}</h3>
                <div className="marketing-process-record">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold tracking-tight text-foreground">
                      {step.record}
                    </p>
                    {index === 1 ? (
                      <StatusChip tone="warning">Due Friday</StatusChip>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-foreground">
                    {step.body}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.meta}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <PreviewCaption>
            Illustrative loop. The same objects exist in Lean Excellence Hub;
            these records are examples, not customer results.
          </PreviewCaption>
        </figure>
      </MarketingContainer>
    </MarketingSection>
  );
}
