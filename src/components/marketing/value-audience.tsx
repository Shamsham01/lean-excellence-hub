import { MarketingAudiencePerspectives } from "./audience-perspectives";
import {
  MarketingContainer,
  MarketingSection,
  SectionIntro,
} from "./primitives";

const VALUE = [
  {
    title: "One source of truth",
    body: "Gemba findings, 5S audits, suggestions, actions, cases, projects and benefits stay in one system instead of rebuilding CI reporting across spreadsheets.",
  },
  {
    title: "Accountability",
    body: "The same action objects carry owners, due dates, source and overdue visibility — whether they started on a walk, an audit or an idea.",
  },
  {
    title: "Participation that does not disappear",
    body: "Frontline suggestions move through review, decision and conversion. Contribution is visible, not lost in a box.",
  },
  {
    title: "Value with validation",
    body: "Projects can capture a forecast benefit. Realisation stays separate until someone validates it. No untested claims.",
  },
] as const;

export function MarketingValue() {
  return (
    <MarketingSection className="marketing-defer">
      <MarketingContainer>
        <SectionIntro
          kicker="Business value"
          title="What a connected system changes."
        >
          <p>
            Functionality only matters if it reduces fragmentation, raises
            accountability and makes improvement results visible.
          </p>
        </SectionIntro>
        <ol className="marketing-value-flow" role="list">
          {VALUE.map((item, index) => (
            <li key={item.title}>
              <p className="marketing-index">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="marketing-subheading mt-3">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </MarketingContainer>
    </MarketingSection>
  );
}

export function MarketingAudience() {
  return (
    <MarketingSection
      id="audience"
      className="marketing-defer border-y border-border bg-surface"
    >
      <MarketingContainer>
        <SectionIntro
          kicker="Who it is for"
          title="One system. Different perspectives."
        >
          <p>
            Lean Excellence Hub is designed for organisations, not only
            individual Lean practitioners. Sites, roles and permissions already
            exist so operational work can be scoped to the people who should see
            it.
          </p>
        </SectionIntro>
        <MarketingAudiencePerspectives />
      </MarketingContainer>
    </MarketingSection>
  );
}
