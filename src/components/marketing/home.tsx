import Link from "next/link";

import { Button } from "@/components/ui/button";

import { MarketingInteractiveExperience } from "./interactive/experience";
import { MarketingJourney } from "./journey";
import { MarketingLeanAi } from "./leanai-preview";
import { MarketingMaturity } from "./maturity-section";
import { MarketingPlatform } from "./platform-previews";
import {
  MarketingContainer,
  MarketingKicker,
  MarketingMark,
  MarketingSection,
  RequestDemoControl,
  SectionIntro,
} from "./primitives";
import { MarketingShell } from "./shell";
import { MarketingSystemVisual } from "./system-visual";
import { MarketingAudience, MarketingValue } from "./value-audience";

type ArtefactKind =
  | "sheet"
  | "email"
  | "register"
  | "form"
  | "workbook"
  | "report"
  | "matrix"
  | "deck";

const FRAGMENT_STAGES: ReadonlyArray<{
  stage: string;
  modules: readonly [string, string];
  artefacts: ReadonlyArray<{
    label: string;
    source: string;
    kind: ArtefactKind;
    gap: string;
  }>;
}> = [
  {
    stage: "Observe",
    modules: ["5S", "Gemba"],
    artefacts: [
      {
        label: "Audit checklist",
        source: "Shared folder",
        kind: "sheet",
        gap: "Findings retyped into actions",
      },
      {
        label: "Gemba findings",
        source: "Email thread",
        kind: "email",
        gap: "No owner, no due date",
      },
    ],
  },
  {
    stage: "Act",
    modules: ["Actions", "Suggestions"],
    artefacts: [
      {
        label: "Open actions",
        source: "Exported register",
        kind: "register",
        gap: "Status found by chasing",
      },
      {
        label: "Suggestion form",
        source: "Standalone form",
        kind: "form",
        gap: "Ideas wait without review",
      },
    ],
  },
  {
    stage: "Improve",
    modules: ["Problem Solving", "Projects & Benefits"],
    artefacts: [
      {
        label: "Project tracker",
        source: "Local workbook",
        kind: "workbook",
        gap: "No link back to the finding",
      },
      {
        label: "Benefits forecast",
        source: "Finance report",
        kind: "report",
        gap: "Forecast, never validated",
      },
    ],
  },
  {
    stage: "Learn",
    modules: ["Training & Skills", "Maturity"],
    artefacts: [
      {
        label: "Training records",
        source: "Separate matrix",
        kind: "matrix",
        gap: "Skills not tied to standards",
      },
      {
        label: "Maturity scores",
        source: "Slide deck",
        kind: "deck",
        gap: "Frozen at the last review",
      },
    ],
  },
];

function ArtefactGlyph({ kind }: { kind: ArtefactKind }) {
  return (
    <svg
      aria-hidden="true"
      className="marketing-artefact-glyph"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.25"
      viewBox="0 0 28 20"
    >
      {kind === "email" ? (
        <>
          <rect x="1.5" y="3.5" width="25" height="13" rx="2" />
          <path d="m2.5 4.75 11.5 7.25 11.5-7.25" />
        </>
      ) : kind === "workbook" ? (
        <>
          <rect x="5" y="1.5" width="21.5" height="14" rx="2" />
          <path d="M5 6.5h21.5M12 1.5v14M1.5 5v11.5a2 2 0 0 0 2 2H22" />
        </>
      ) : kind === "matrix" ? (
        <>
          <rect x="1.5" y="1.5" width="25" height="17" rx="2" />
          <circle cx="8" cy="7" r="1.6" fill="currentColor" />
          <circle cx="14" cy="7" r="1.6" fill="currentColor" />
          <circle cx="20" cy="7" r="1.6" />
          <circle cx="8" cy="13" r="1.6" fill="currentColor" />
          <circle cx="14" cy="13" r="1.6" />
          <circle cx="20" cy="13" r="1.6" />
        </>
      ) : kind === "deck" ? (
        <>
          <rect x="1.5" y="1.5" width="25" height="13.5" rx="2" />
          <path d="M14 15v3.5M10 18.5h8M8 11.5v-2.5M12.5 11.5V6M17 11.5V8M21 11.5V5" />
        </>
      ) : (
        <>
          <rect x="1.5" y="1.5" width="25" height="17" rx="2" />
          {kind === "sheet" ? (
            <path d="M1.5 7h25M1.5 12.5h25M9 1.5v17" />
          ) : kind === "register" ? (
            <path d="M5.5 6.5h1.5M10 6.5h12.5M5.5 10h1.5M10 10h12.5M5.5 13.5h1.5M10 13.5h8" />
          ) : kind === "form" ? (
            <path d="M5.5 5.5h17v3h-17zM5.5 11.5h10v3h-10z" />
          ) : (
            <path d="m5.5 14 4.5-4 4 2.5 8.5-6.5" strokeDasharray="2 2" />
          )}
        </>
      )}
    </svg>
  );
}

export function MarketingHome() {
  return (
    <MarketingShell>
      <Hero />
      <Problem />
      <MarketingJourney />
      <MarketingInteractiveExperience />
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
              <a href="#try-leh">Try LEH</a>
            </Button>
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
        <figure className="marketing-fragments">
          <div className="marketing-fragments-head">
            <span className="marketing-fragments-head-label">Today</span>
            <span className="marketing-fragments-head-note">
              Separate files, separate owners.
            </span>
          </div>
          <div className="marketing-fragments-head-system" aria-hidden="true">
            <span className="marketing-fragments-head-label">
              <MarketingMark />
              In LEH
            </span>
            <span className="marketing-fragments-head-note">
              One connected loop
            </span>
          </div>
          <ol className="marketing-fragments-grid" role="list">
            {FRAGMENT_STAGES.map((group) => (
              <li key={group.stage} className="marketing-fragments-stage">
                <ul className="marketing-fragments-artefacts" role="list">
                  {group.artefacts.map((artefact) => (
                    <li
                      key={artefact.label}
                      className="marketing-artefact"
                      data-kind={artefact.kind}
                    >
                      <span className="marketing-artefact-top">
                        <span className="marketing-artefact-source">
                          {artefact.source}
                        </span>
                        <ArtefactGlyph kind={artefact.kind} />
                      </span>
                      <span className="marketing-artefact-label">
                        {artefact.label}
                      </span>
                      <span className="marketing-artefact-gap">
                        {artefact.gap}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="marketing-fragments-resolve">
                  <span className="sr-only">In Lean Excellence Hub: </span>
                  <span className="marketing-fragments-stage-name">
                    {group.stage}
                  </span>
                  <span className="marketing-fragments-modules">
                    {group.modules.map((name) => (
                      <span key={name}>{name}</span>
                    ))}
                  </span>
                </p>
              </li>
            ))}
          </ol>
          <figcaption className="marketing-fragments-caption">
            <MarketingMark />
            <span>
              The differentiator is not another Lean toolkit. It is one system
              in which observation, action, problem solving, capability and
              benefits stay connected.
            </span>
          </figcaption>
        </figure>
      </MarketingContainer>
    </MarketingSection>
  );
}

function FinalCta() {
  return (
    <MarketingSection>
      <MarketingContainer>
        <div className="max-w-3xl">
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
