import {
  MarketingContainer,
  MarketingSection,
  PreviewCaption,
  SectionIntro,
  StatusChip,
} from "./primitives";

const LIFECYCLE = ["Draft", "Review", "Publish", "Assess", "Improve"] as const;

const COUNTS = [
  { label: "Pillars", value: "5" },
  { label: "Criteria", value: "30" },
  { label: "Scored questions", value: "60" },
] as const;

export function MarketingMaturity() {
  return (
    <MarketingSection
      id="maturity-system"
      className="marketing-defer border-y border-border bg-surface"
    >
      <MarketingContainer className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
        <SectionIntro
          kicker="The connecting layer"
          title="Maturity without a proprietary doctrine."
        >
          <p>
            Start from the LEH Operational Excellence Standard, or author your
            own framework. Customise copy, structure and scoring so the
            organisation owns the method. LEH supplies the engine, not the
            doctrine.
          </p>
        </SectionIntro>

        <figure>
          <div className="marketing-preview marketing-preview-featured">
            <div className="marketing-preview-chrome">
              <p className="marketing-preview-title">
                LEH Operational Excellence Standard
              </p>
              <StatusChip tone="accent">Optional starting point</StatusChip>
            </div>
            <div className="marketing-preview-body">
              <dl className="marketing-count-row">
                {COUNTS.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Framework lifecycle
              </p>
              <ol className="marketing-lifecycle" role="list">
                {LIFECYCLE.map((step, index) => (
                  <li
                    key={step}
                    data-current={index === 0 ? "true" : undefined}
                  >
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Organisations can later use operational evidence from LEH
                modules to support how they assess maturity. Evidence-linked
                scoring is not implied here.
              </p>
            </div>
          </div>
          <PreviewCaption>
            Product capability currently in Lean Excellence Hub: author, review,
            publish and assess a framework you own.
          </PreviewCaption>
        </figure>
      </MarketingContainer>
    </MarketingSection>
  );
}
