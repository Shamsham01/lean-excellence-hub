import {
  MarketingContainer,
  MarketingSection,
  PreviewCaption,
  SectionIntro,
  StatusChip,
} from "./primitives";

export function MarketingLeanAi() {
  return (
    <MarketingSection id="leanai" className="marketing-defer">
      <MarketingContainer className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
        <SectionIntro
          kicker="LeanAI"
          title="Context, assistance, then a person decides."
        >
          <p>
            LeanAI works inside Lean Excellence Hub, with the organisation, site
            and current workflow in view. It helps people operate the system. It
            does not make authoritative operational decisions.
          </p>
        </SectionIntro>

        <figure className="marketing-leanai">
          <div className="marketing-preview">
            <div className="marketing-preview-chrome">
              <p className="marketing-preview-title">LeanAI</p>
              <StatusChip tone="accent">Contextual assistant</StatusChip>
            </div>
            <div className="marketing-preview-body">
              <p className="text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Context
              </p>
              <p className="mt-1.5 text-sm font-medium text-foreground">
                Maturity → Operational Excellence Standard → Draft
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Organisation · current site · framework authoring
              </p>

              <p className="mt-5 text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Assistance
              </p>
              <ul className="marketing-assist" role="list">
                <li>Explain scoring</li>
                <li>Review framework</li>
                <li>Continue setup</li>
              </ul>

              <div className="marketing-governance">
                <p className="text-[0.68rem] font-semibold tracking-[0.12em] text-accent-foreground uppercase">
                  Governance
                </p>
                <p className="mt-1.5 text-sm leading-6 text-foreground">
                  LeanAI can explain the current setup and the next governed
                  step. A person reviews and publishes.
                </p>
              </div>
            </div>
          </div>
          <PreviewCaption>
            LeanAI does not publish frameworks or close actions on its own.
          </PreviewCaption>
        </figure>
      </MarketingContainer>
    </MarketingSection>
  );
}
