import Link from "next/link";

import { Button } from "@/components/ui/button";

import { MarketingJourney } from "./journey";
import { MarketingLeanAi } from "./leanai-preview";
import { MarketingMaturity } from "./maturity-section";
import { MarketingPlatform } from "./platform-previews";
import {
  MarketingContainer,
  MarketingKicker,
  MarketingSection,
  RequestDemoControl,
  SectionIntro,
} from "./primitives";
import { MarketingShell } from "./shell";
import { MarketingSystemVisual } from "./system-visual";
import { MarketingAudience, MarketingValue } from "./value-audience";

const FRAGMENTS = [
  {
    label: "Audit checklist",
    source: "Shared folder",
    kind: "sheet",
  },
  {
    label: "Gemba findings",
    source: "Email thread",
    kind: "email",
  },
  {
    label: "Open actions",
    source: "Exported register",
    kind: "sheet",
  },
  {
    label: "Suggestion form",
    source: "Standalone form",
    kind: "form",
  },
  {
    label: "Project tracker",
    source: "Local workbook",
    kind: "sheet",
  },
  {
    label: "Training records",
    source: "Separate matrix",
    kind: "form",
  },
  {
    label: "Maturity scores",
    source: "Slide deck",
    kind: "report",
  },
  {
    label: "Benefits forecast",
    source: "Unvalidated",
    kind: "report",
  },
] as const;

export function MarketingHome() {
  return (
    <MarketingShell>
      <Hero />
      <Problem />
      <MarketingJourney />
      <MarketingPlatform />
      <MarketingLeanAi />
      <MarketingMaturity />
      <MarketingValue />
      <MarketingAudience />
      <FinalCta />
    </MarketingShell>
  );
}

function Hero() {
  return (
    <MarketingSection flush className="marketing-hero">
      <MarketingContainer
        wide
        className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(22rem,1.08fr)] lg:gap-12"
      >
        <div>
          <MarketingKicker>
            The operating system for Continuous Improvement
          </MarketingKicker>
          <h1 className="marketing-display mt-4">
            Operational excellence. Connected.
          </h1>
          <p className="marketing-lede mt-5">
            Connect frontline evidence to owned action, structured solving,
            validated benefits and organisational learning — in one Continuous
            Improvement system.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <RequestDemoControl />
            <Button asChild variant="outline">
              <a href="#platform">Explore the platform</a>
            </Button>
          </div>
        </div>
        <MarketingSystemVisual />
      </MarketingContainer>
    </MarketingSection>
  );
}

function Problem() {
  return (
    <MarketingSection
      id="why"
      className="border-t border-border bg-surface pt-12 sm:pt-16"
    >
      <MarketingContainer>
        <SectionIntro
          kicker="The problem"
          title="Continuous Improvement shouldn't live in disconnected spreadsheets."
        >
          <p>
            Operational Excellence teams commonly manage audits, Gemba findings,
            actions, suggestions, improvement projects, training, maturity
            assessments and benefits across disconnected tools. Lean Excellence
            Hub brings them into one connected improvement system.
          </p>
        </SectionIntro>
        <ul className="marketing-fragment mt-8" role="list">
          {FRAGMENTS.map((item) => (
            <li key={item.label} data-kind={item.kind}>
              <span className="marketing-fragment-label">{item.label}</span>
              <span className="marketing-fragment-source">{item.source}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-muted-foreground">
          The differentiator is not another Lean toolkit. It is one system in
          which observation, action, problem solving, capability and benefits
          stay connected.
        </p>
      </MarketingContainer>
    </MarketingSection>
  );
}

function FinalCta() {
  return (
    <MarketingSection>
      <MarketingContainer className="max-w-3xl">
        <h2 className="marketing-heading">
          Build a Continuous Improvement system people actually use.
        </h2>
        <p className="marketing-lede mt-5">
          Connect improvement activity, capability and results in one
          Operational Excellence platform.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <RequestDemoControl />
          <Button asChild variant="outline">
            <a href="#platform">Explore the platform</a>
          </Button>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}

export function MarketingDemoPage() {
  return (
    <MarketingShell>
      <MarketingSection flush className="marketing-hero">
        <MarketingContainer className="max-w-3xl">
          <MarketingKicker>Request a demo</MarketingKicker>
          <h1 className="marketing-display mt-4">
            See how Lean Excellence Hub can connect your Continuous Improvement
            system.
          </h1>
          <p className="marketing-lede mt-5">
            A demo is a structured walkthrough of the connected operating system
            — not a booking calendar, and not a claim about results you have not
            measured.
          </p>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection className="border-y border-border bg-surface">
        <MarketingContainer>
          <SectionIntro title="What a demo is for">
            <p>
              We use it to show how evidence, action, problem solving,
              improvement and learning stay connected in Lean Excellence Hub.
            </p>
          </SectionIntro>
          <ul className="marketing-demo-outcomes mt-8" role="list">
            <li>
              <h2 className="marketing-subheading">The connected loop</h2>
              <p>
                How a Gemba finding becomes an owned action, a problem-solving
                case, a project and a benefit awaiting validation.
              </p>
            </li>
            <li>
              <h2 className="marketing-subheading">Maturity as the engine</h2>
              <p>
                How organisations start from the LEH Operational Excellence
                Standard — 5 pillars, 30 criteria, 60 scored questions — or
                author their own framework.
              </p>
            </li>
            <li>
              <h2 className="marketing-subheading">LeanAI with governance</h2>
              <p>
                How assistance stays inside the current organisation, site and
                workflow, while a person still reviews and publishes.
              </p>
            </li>
            <li>
              <h2 className="marketing-subheading">Scope and roles</h2>
              <p>
                How Operational Excellence leadership, site leadership, area
                leaders and frontline teams can work in the same system without
                seeing the same things.
              </p>
            </li>
          </ul>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer className="max-w-3xl">
          <h2 className="marketing-heading">Next step</h2>
          <p className="marketing-copy mt-4">
            Demo requests are not yet connected to a scheduling or inbox
            destination. We have not invented an email address or calendar
            availability. Qualification, scheduling and confirmation still need
            a real contact path before requests can be collected here.
          </p>
          <p className="marketing-copy mt-4">
            If you already have access, sign in. To see the public product
            story, explore the platform on the homepage.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/#platform">Explore the platform</Link>
            </Button>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingShell>
  );
}
