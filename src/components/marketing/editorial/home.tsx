"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_BOOKING_CTA } from "@/lib/marketing/demo-booking";
import {
  MarketingModuleFigure,
  ProductVignetteChrome,
  type MarketingModuleId,
} from "@/components/marketing/platform-previews";
import {
  MarketingContainer,
  StatusChip,
} from "@/components/marketing/primitives";
import {
  MarketingActionCard,
  MarketingGembaFindingCard,
} from "./marketing-action-card";
import { ScrollReveal } from "./scroll-reveal";

import "./home.css";

type ChipTone = "neutral" | "accent" | "connected" | "warning";

type LineageStep = {
  id: string;
  index: string;
  title: string;
  module: string;
  summary: string;
  ref: string;
  recordTitle: string;
  status: string;
  tone: ChipTone;
  fields: ReadonlyArray<readonly [string, string]>;
};

const LINEAGE: readonly LineageStep[] = [
  {
    id: "observe",
    index: "01",
    title: "Observe",
    module: "Gemba",
    summary: "Gemba identifies packaging misalignment on Packing Line 1.",
    ref: "GEM-214",
    recordTitle: "Packaging film misaligned on Packing Line 1",
    status: "Finding recorded",
    tone: "warning",
    fields: [
      ["Source", "Morning Gemba walk"],
      ["Area", "Packing Line 1"],
      ["Owner", "Packing supervisor"],
      ["Leads to", "ACT-318"],
    ],
  },
  {
    id: "act",
    index: "02",
    title: "Act",
    module: "Actions",
    summary: "A corrective action receives an accountable owner and due date.",
    ref: "ACT-318",
    recordTitle: "Realign the film guide and confirm the first-off pack",
    status: "Assigned",
    tone: "accent",
    fields: [
      ["Owner", "Packing supervisor"],
      ["Due", "Friday"],
      ["Source", "GEM-214"],
      ["Priority", "Contain the misalignment"],
    ],
  },
  {
    id: "solve",
    index: "03",
    title: "Solve",
    module: "Problem solving",
    summary:
      "A CI team investigates the causes using its chosen problem-solving method.",
    ref: "PS-077",
    recordTitle: "Recurring film wander on Packing Line 1",
    status: "Cause analysis",
    tone: "accent",
    fields: [
      ["Method", "The organisation's chosen method"],
      ["Team", "CI team"],
      ["Linked from", "GEM-214 · ACT-318"],
      ["Stage", "Cause analysis"],
    ],
  },
  {
    id: "improve",
    index: "04",
    title: "Improve",
    module: "Projects & Benefits",
    summary:
      "Countermeasures are managed through a project and tracked to verified outcomes.",
    ref: "PRJ-042",
    recordTitle: "Packing Line 1 film-path countermeasures",
    status: "Active",
    tone: "connected",
    fields: [
      ["Owner", "CI manager"],
      ["Milestone", "Guide redesign in trial"],
      ["Benefit", "BEN-019 awaiting validation"],
      ["Outcome", "Nothing is shown as verified yet"],
    ],
  },
  {
    id: "learn",
    index: "05",
    title: "Learn",
    module: "Standards & skills",
    summary:
      "Updated standards and capability requirements support sustained improvement.",
    ref: "CAP-014",
    recordTitle: "Film-change standard and packing competence",
    status: "Draft for review",
    tone: "neutral",
    fields: [
      ["Standard", "Packing Line 1 film-change · draft"],
      ["Capability", "Film-change competence for packing operators"],
      ["Owner", "CI manager"],
      ["From", "PRJ-042"],
    ],
  },
];

const MODULES: ReadonlyArray<{
  id: MarketingModuleId;
  name: string;
  line: string;
}> = [
  {
    id: "maturity",
    name: "Maturity",
    line: "Define your operating standard.",
  },
  {
    id: "gemba",
    name: "Gemba",
    line: "See the work where it happens.",
  },
  {
    id: "five-s",
    name: "5S",
    line: "Turn standards into repeatable practice.",
  },
  {
    id: "suggestions",
    name: "Suggestions",
    line: "Turn frontline ideas into visible decisions.",
  },
  {
    id: "actions",
    name: "Actions",
    line: "One accountable action system.",
  },
  {
    id: "problem-solving",
    name: "Problem Solving",
    line: "Use your methodology. Keep the evidence.",
  },
  {
    id: "projects-benefits",
    name: "Projects & Benefits",
    line: "Connect delivered change to validated value.",
  },
  {
    id: "training-skills",
    name: "Training & Skills",
    line: "Build capability against your standards.",
  },
];

const FAQ_ITEMS = [
  {
    id: "faq-what",
    q: "What is Lean Excellence Hub?",
    a: "A B2B platform for Continuous Improvement and Operational Excellence: maturity, Gemba, 5S, suggestions, actions, problem solving, projects, benefits, scheduling, recognition, training and capability in one connected system.",
  },
  {
    id: "faq-demo",
    q: "How do I book a demonstration?",
    a: "Use Book a live demo to open the scheduling page. A meeting is confirmed only after the scheduling provider accepts the time you choose.",
  },
  {
    id: "faq-data",
    q: "Are the records on this page real customer data?",
    a: "No. Product previews and examples on this marketing site use illustrative records only. They are not customer performance data.",
  },
  {
    id: "faq-leanai",
    q: "How does LeanAI relate to publishing and access?",
    a: "LeanAI can find, explain and recommend inside the current organisation, site and workflow. Publishing, closure, access and purchasing stay with a person.",
  },
] as const;

const LEAN_BEATS = [
  {
    index: "01",
    title: "Context",
    body: "Organisation, site, role where permitted, current workflow, open record and relevant framework.",
  },
  {
    index: "02",
    title: "Understand",
    body: "LeanAI understands where the user is and what the workflow is for.",
  },
  {
    index: "03",
    title: "Connect",
    body: "It can bring related work and the organisation's current standard into the conversation.",
  },
  {
    index: "04",
    title: "Coach",
    body: "It explains the next governed step and helps the user operate and set up the platform.",
  },
  {
    index: "05",
    title: "Recommend",
    body: "It can suggest a next step inside the open workflow. A person chooses whether to act.",
  },
  {
    index: "06",
    title: "You decide",
    body: "Publishing, closure, access and purchasing stay with a person.",
  },
] as const;

const SIGNATURE_ACTION = {
  actionRef: "ACT-318",
  title: "Realign the film guide and confirm the first-off pack",
  owner: "Packing supervisor",
  due: "Friday",
  sourceModule: "Gemba",
  sourceRef: "GEM-214",
  sourceTitle: "Packaging film misaligned on Packing Line 1",
} as const;

const STORY_CHIPS = [
  "GEM-214",
  "ACT-318",
  "PS-077",
  "PRJ-042",
  "CAP-014",
] as const;

function HeroActionStage() {
  return (
    <figure className="editorial-stage editorial-action-stage">
      <div className="editorial-hero-stack">
        <div className="editorial-hero-stack-plate" aria-hidden="true" />
        <MarketingGembaFindingCard
          className="editorial-hero-stack-gemba"
          findingRef="GEM-214"
          title="Packaging film misaligned on Packing Line 1"
          meta="Morning Gemba walk · Packing supervisor · Packing Line 1"
        />
        <MarketingActionCard
          id="signature-action-hero"
          variant="hero"
          className="editorial-hero-stack-action"
          hideAuxNote
          animateHeroStatus
          actionRef={SIGNATURE_ACTION.actionRef}
          title={SIGNATURE_ACTION.title}
          owner={SIGNATURE_ACTION.owner}
          due={SIGNATURE_ACTION.due}
          status="Assigned"
          statusTone="accent"
          sourceModule={SIGNATURE_ACTION.sourceModule}
          sourceRef={SIGNATURE_ACTION.sourceRef}
          sourceTitle={SIGNATURE_ACTION.sourceTitle}
          leanAiSuggestion={
            <>
              Confirm first-off pack photos are attached before closure. Link to
              problem-solving case PS-077 if misalignment repeats.
            </>
          }
        />
      </div>
      <p className="marketing-preview-aux-note editorial-hero-stack-note">
        Example data · fictional site
      </p>
      <figcaption className="editorial-stage-caption">
        The LEH Action Card carries owner, due date, source and status — from
        floor finding to accountable follow-up.
      </figcaption>
    </figure>
  );
}

function DashboardOutcomeVisual() {
  return (
    <figure className="editorial-dashboard-outcome">
      <div className="editorial-dashboard-shell">
        <div className="editorial-dashboard-chrome">
          <span
            className="editorial-dots inline-flex gap-[0.3rem]"
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </span>
          <p className="m-0 min-w-0 flex-1 truncate text-[0.72rem] font-semibold tracking-wide text-foreground">
            Bodmin Bakery · Operations dashboard
          </p>
          <StatusChip tone="connected">Example</StatusChip>
        </div>
        <div className="editorial-dashboard-body">
          <p className="editorial-context-kicker">
            Stage 4 · Improve · dashboard
          </p>
          <div
            className="editorial-dashboard-kpis"
            role="group"
            aria-label="Example operational KPIs"
          >
            <div className="editorial-dashboard-kpi">
              <p className="editorial-dashboard-kpi-label">Open actions</p>
              <p className="editorial-dashboard-kpi-value">11</p>
              <StatusChip tone="success">ACT-318 closed</StatusChip>
            </div>
            <div className="editorial-dashboard-kpi">
              <p className="editorial-dashboard-kpi-label">
                Benefit validation
              </p>
              <p className="editorial-dashboard-kpi-value">1</p>
              <p className="editorial-dashboard-kpi-note">
                BEN-019 · Awaiting validation
              </p>
            </div>
            <div className="editorial-dashboard-kpi">
              <p className="editorial-dashboard-kpi-label">Cases in flight</p>
              <p className="editorial-dashboard-kpi-value">4</p>
              <p className="editorial-dashboard-kpi-note">PS-077 · Analyse</p>
            </div>
          </div>
          <MarketingActionCard
            variant="inline"
            storyStage="Stage 2 · Act · verified on the line"
            actionRef="ACT-318"
            title="Realign the film guide and confirm the first-off pack"
            owner="Packing supervisor"
            status="Verified"
            statusTone="success"
            sourceModule="Gemba"
            sourceRef="GEM-214"
            sourceTitle="Packaging film misaligned on Packing Line 1"
            validationNote="Action closure is shown here. Benefit record BEN-019 remains awaiting validation — forecast and realisation stay separate."
          />
        </div>
      </div>
      <figcaption className="marketing-preview-aux-note">
        Example data · fictional site
      </figcaption>
    </figure>
  );
}

function StoryEvidencePanel({ step }: { step: LineageStep }) {
  if (step.id === "observe") {
    return (
      <article className="editorial-record editorial-record-gemba">
        <div className="editorial-record-head">
          <div>
            <p className="editorial-record-ref">{step.ref}</p>
            <h3>{step.recordTitle}</h3>
          </div>
          <StatusChip tone={step.tone}>{step.status}</StatusChip>
        </div>
        <div className="editorial-finding editorial-record-finding">
          <p className="editorial-finding-meta">
            Packing Line 1 · Photo attached · Issue recorded on walk
          </p>
        </div>
        <StoryRecordMeta step={step} />
      </article>
    );
  }

  if (step.id === "act") {
    return (
      <MarketingActionCard
        variant="story"
        actionRef={SIGNATURE_ACTION.actionRef}
        title={SIGNATURE_ACTION.title}
        owner={SIGNATURE_ACTION.owner}
        due={SIGNATURE_ACTION.due}
        status="Assigned"
        statusTone="accent"
        sourceModule={SIGNATURE_ACTION.sourceModule}
        sourceRef={SIGNATURE_ACTION.sourceRef}
        sourceTitle={SIGNATURE_ACTION.sourceTitle}
      />
    );
  }

  if (step.id === "solve") {
    return (
      <div className="editorial-record-stack">
        <article className="editorial-record">
          <div className="editorial-record-head">
            <div>
              <p className="editorial-record-ref">{step.ref}</p>
              <h3>{step.recordTitle}</h3>
            </div>
            <StatusChip tone={step.tone}>{step.status}</StatusChip>
          </div>
          <StoryRecordMeta step={step} />
        </article>
        <MarketingActionCard
          variant="story"
          actionRef={SIGNATURE_ACTION.actionRef}
          title={SIGNATURE_ACTION.title}
          owner={SIGNATURE_ACTION.owner}
          due={SIGNATURE_ACTION.due}
          status="In progress"
          statusTone="warning"
          sourceModule={SIGNATURE_ACTION.sourceModule}
          sourceRef={SIGNATURE_ACTION.sourceRef}
          sourceTitle={SIGNATURE_ACTION.sourceTitle}
          leanAiSuggestion={
            <>
              Add a run chart for film position by changeover batch before
              moving to countermeasures. Linked context: PS-077 · Cause
              analysis.
            </>
          }
        />
      </div>
    );
  }

  if (step.id === "improve") {
    return (
      <div className="editorial-record-stack">
        <article className="editorial-record">
          <div className="editorial-record-head">
            <div>
              <p className="editorial-record-ref">{step.ref}</p>
              <h3>{step.recordTitle}</h3>
            </div>
            <StatusChip tone={step.tone}>{step.status}</StatusChip>
          </div>
          <StoryRecordMeta step={step} />
        </article>
        <DashboardOutcomeVisual />
      </div>
    );
  }

  return (
    <article className="editorial-record">
      <div className="editorial-record-head">
        <div>
          <p className="editorial-record-ref">{step.ref}</p>
          <h3>{step.recordTitle}</h3>
        </div>
        <StatusChip tone={step.tone}>{step.status}</StatusChip>
      </div>
      <StoryRecordMeta step={step} />
      <MarketingActionCard
        variant="inline"
        className="editorial-record-action-tail"
        storyStage="Stage 5 · Learn · linked action"
        actionRef={SIGNATURE_ACTION.actionRef}
        title={SIGNATURE_ACTION.title}
        owner="CI manager"
        status="Closed"
        statusTone="success"
        sourceModule="Project"
        sourceRef="PRJ-042"
        sourceTitle="Packing Line 1 film-path countermeasures"
        validationNote="Standard CAP-014 draft references the closed action. Benefit BEN-019 is still awaiting validation."
      />
    </article>
  );
}

function StoryRecordMeta({ step }: { step: LineageStep }) {
  return (
    <>
      <ol className="editorial-chain" aria-label="Connected records">
        {STORY_CHIPS.map((ref) => (
          <li key={ref} data-current={ref === step.ref || undefined}>
            {ref}
          </li>
        ))}
      </ol>
      <dl className="editorial-fields">
        {step.fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="editorial-record-foot">
        Same system · Harbourfield Foods Group — Bodmin Bakery · {step.module}
      </p>
    </>
  );
}

function CloseFrameworkVisual() {
  return (
    <figure className="editorial-close-visual editorial-rise editorial-rise-delay">
      <div className="editorial-framework-shell">
        <div className="editorial-framework-chrome">
          <span
            className="editorial-dots inline-flex gap-[0.3rem]"
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </span>
          <p className="m-0 min-w-0 flex-1 truncate text-[0.72rem] font-semibold tracking-wide text-foreground">
            Operating model
          </p>
          <StatusChip className="shrink-0">Example</StatusChip>
        </div>
        <div className="editorial-framework-body">
          <p className="editorial-framework-kicker">Structure</p>
          <ol
            className="editorial-framework-layers"
            aria-label="Organisation structure"
          >
            <li className="editorial-framework-layer editorial-framework-layer-org">
              <div className="editorial-framework-layer-head">
                <p className="editorial-framework-layer-title">Organisation</p>
                <StatusChip tone="accent">Configured</StatusChip>
              </div>
              <p className="editorial-framework-layer-detail">
                Harbourfield Foods Group
              </p>
            </li>
            <li className="editorial-framework-layer editorial-framework-layer-site">
              <div className="editorial-framework-layer-head">
                <p className="editorial-framework-layer-title">Sites</p>
                <StatusChip tone="connected">Rolled out</StatusChip>
              </div>
              <p className="editorial-framework-layer-detail">
                Bodmin Bakery · Manchester DC
              </p>
            </li>
            <li className="editorial-framework-layer editorial-framework-layer-area">
              <div className="editorial-framework-layer-head">
                <p className="editorial-framework-layer-title">Areas</p>
                <StatusChip tone="neutral">Scoped</StatusChip>
              </div>
              <p className="editorial-framework-layer-detail">
                Packing · Goods-in · Maintenance
              </p>
            </li>
          </ol>
          <p className="editorial-framework-kicker editorial-framework-kicker-spaced">
            Your standards & methods
          </p>
          <div className="editorial-framework-cards">
            <Card className="editorial-framework-card gap-2 border-primary/30 p-3 shadow-none sm:p-3.5">
              <CardHeader className="gap-1 p-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-xs font-semibold sm:text-sm">
                    Maturity model
                  </CardTitle>
                  <StatusChip tone="accent">Yours</StatusChip>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <p className="marketing-field-label">Framework</p>
                <p className="marketing-field-value">
                  LEH Operational Excellence Standard
                </p>
              </CardContent>
            </Card>
            <Card className="editorial-framework-card gap-2 border-primary/30 p-3 shadow-none sm:p-3.5">
              <CardHeader className="gap-1 p-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-xs font-semibold sm:text-sm">
                    Problem solving
                  </CardTitle>
                  <StatusChip tone="connected">Method</StatusChip>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <p className="marketing-field-label">Organisation method</p>
                <p className="marketing-field-value">
                  The organisation&apos;s chosen method (example: A3 · DMAIC ·
                  8D)
                </p>
              </CardContent>
            </Card>
            <Card className="editorial-framework-card gap-2 border-primary/30 p-3 shadow-none sm:p-3.5">
              <CardHeader className="gap-1 p-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-xs font-semibold sm:text-sm">
                    Standards library
                  </CardTitle>
                  <StatusChip tone="connected">Aligned</StatusChip>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <p className="marketing-field-label">Work standards</p>
                <p className="marketing-field-value">
                  Packing changeover · Goods-in 5S · Film path control
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <figcaption className="marketing-preview-aux-note">
        Example data · fictional site
      </figcaption>
    </figure>
  );
}

function FindingStory() {
  const [activeId, setActiveId] = useState("observe");
  const active = LINEAGE.find((step) => step.id === activeId);

  if (!active) {
    return null;
  }

  return (
    <div className="editorial-story editorial-story-shell">
      <ol className="editorial-lineage">
        {LINEAGE.map((step) => {
          const selected = step.id === active.id;
          return (
            <li key={step.id}>
              <button
                type="button"
                className="editorial-step"
                aria-pressed={selected}
                aria-controls="finding-record"
                onClick={() => setActiveId(step.id)}
              >
                <span className="editorial-step-index" aria-hidden="true">
                  {step.index}
                </span>
                <h3 id={`finding-step-${step.id}`}>{step.title}</h3>
                <p className="editorial-step-module">{step.module}</p>
                <p className="editorial-step-summary">{step.summary}</p>
              </button>
            </li>
          );
        })}
      </ol>

      <div
        id="finding-record"
        className="editorial-story-evidence"
        aria-labelledby={`finding-step-${active.id}`}
        key={active.id}
      >
        <StoryEvidencePanel step={active} />
      </div>
    </div>
  );
}

export function EditorialHome() {
  return (
    <div className="editorial-home">
      <section id="connect" className="editorial-hero">
        <MarketingContainer>
          <div className="editorial-hero-grid">
            <div className="editorial-hero-copy editorial-rise">
              <p className="marketing-kicker">
                The Continuous Improvement Platform
              </p>
              <h1 className="editorial-display">
                Make continuous improvement visible, accountable and measurable.
              </h1>
              <p className="editorial-lede">
                Connect frontline observations, actions, problem solving and
                organisational learning in one platform built around your
                standards.
              </p>
              <div className="editorial-actions editorial-hero-actions">
                <Button asChild className="marketing-cta">
                  <Link href="/demo">{DEMO_BOOKING_CTA}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="editorial-hero-tertiary"
                >
                  <a href="#platform">
                    Explore the platform
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
            <ScrollReveal className="editorial-rise editorial-rise-delay" delay>
              <HeroActionStage />
            </ScrollReveal>
          </div>
          <p className="editorial-principle">
            <strong>One connected platform.</strong>
            <span>Your framework, your standards, your way of working.</span>
          </p>
        </MarketingContainer>
      </section>

      <section
        className="editorial-statement editorial-statement-connected"
        aria-label="Positioning statement"
      >
        <MarketingContainer wide>
          <ScrollReveal>
            <p className="editorial-statement-text">
              Operational excellence.{" "}
              <span className="editorial-statement-accent">Connected.</span>
            </p>
            <p className="editorial-statement-sub">
              One spine of evidence — from the floor, through LeanAI, into owned
              actions, to verified results on the dashboard.
            </p>
          </ScrollReveal>
        </MarketingContainer>
      </section>

      <section
        id="why"
        className="editorial-section editorial-band editorial-section-premium"
      >
        <MarketingContainer>
          <div className="editorial-section-head">
            <p className="marketing-kicker">From one finding</p>
            <h2 className="editorial-heading">
              One finding. Every next step connected.
            </h2>
            <p className="editorial-lede">
              A quality or operational issue is identified during a Gemba walk.
              Lean Excellence Hub connects that observation to action,
              structured problem solving, an improvement project and benefit
              validation.
            </p>
            <p className="editorial-note">
              Fictional example continuing the same site. No customer results or
              savings are shown.
            </p>
          </div>
          <ScrollReveal>
            <FindingStory />
          </ScrollReveal>
        </MarketingContainer>
      </section>

      <section
        className="editorial-statement editorial-statement-evidence"
        aria-label="Product evidence"
      >
        <MarketingContainer>
          <ScrollReveal delay>
            <div className="editorial-statement-grid">
              <div className="editorial-statement-copy">
                <p className="marketing-kicker">The Action Card</p>
                <h2 className="editorial-heading editorial-statement-heading">
                  Accountability you can see on the floor and on the dashboard.
                </h2>
                <p className="editorial-lede">
                  The same object carries owner, due date, linked source and
                  status whether it started on a Gemba walk, a 5S audit or a
                  problem-solving case.
                </p>
                <Button asChild className="marketing-cta">
                  <Link href="/demo">{DEMO_BOOKING_CTA}</Link>
                </Button>
              </div>
              <MarketingActionCard
                variant="story"
                className="editorial-action-card-parallax"
                actionRef={SIGNATURE_ACTION.actionRef}
                title={SIGNATURE_ACTION.title}
                owner={SIGNATURE_ACTION.owner}
                due={SIGNATURE_ACTION.due}
                status="Assigned"
                statusTone="accent"
                sourceModule={SIGNATURE_ACTION.sourceModule}
                sourceRef={SIGNATURE_ACTION.sourceRef}
                sourceTitle={SIGNATURE_ACTION.sourceTitle}
              />
            </div>
          </ScrollReveal>
        </MarketingContainer>
      </section>

      <section
        id="platform"
        className="editorial-section editorial-section-premium"
      >
        <MarketingContainer>
          <div className="editorial-section-head">
            <p className="marketing-kicker">The platform</p>
            <h2 className="editorial-heading">
              One connected improvement system.
            </h2>
            <p className="editorial-lede">
              Maturity, frontline evidence, actions, problem solving, projects
              and capability stay in one operating system. Each area is useful
              on its own. Together they are how improvement actually runs.
            </p>
            <p className="marketing-platform-disclosure">
              Product previews use illustrative example records. They are not
              customer performance data.
            </p>
            <p className="editorial-note">
              Scheduling and recognition are part of the same operating system.
            </p>
          </div>
          <ol className="editorial-modules editorial-modules-premium">
            {MODULES.map((module, index) => (
              <li key={module.id} className="editorial-module">
                <div className="editorial-module-copy">
                  <p className="editorial-module-index">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3>{module.name}</h3>
                  <p>{module.line}</p>
                </div>
                <MarketingModuleFigure id={module.id} />
              </li>
            ))}
          </ol>
        </MarketingContainer>
      </section>

      <section
        id="leanai"
        className="editorial-section editorial-band editorial-section-premium"
      >
        <MarketingContainer>
          <div className="editorial-lean">
            <div className="editorial-section-head">
              <p className="marketing-kicker">LeanAI</p>
              <h2 className="editorial-heading">
                Context first. Assistance second. You decide.
              </h2>
              <p className="editorial-lede">
                LeanAI can find, explain and recommend inside the current
                organisation, site and workflow. A person reviews. A person
                decides.
              </p>
              <ol className="editorial-beats">
                {LEAN_BEATS.map((beat) => (
                  <li key={beat.index}>
                    <h3>
                      <span>{beat.index}</span>
                      {beat.title}
                    </h3>
                    <p>{beat.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="editorial-lean-visuals">
              <figure className="editorial-assistant">
                <div className="marketing-preview marketing-preview-product">
                  <ProductVignetteChrome
                    title="LeanAI"
                    route="/platform · Assistant · GEM-214"
                    badge={
                      <StatusChip tone="accent">
                        Contextual assistant
                      </StatusChip>
                    }
                  />
                  <div className="marketing-preview-body">
                    <p className="editorial-label">Context</p>
                    <ol className="editorial-context-path">
                      <li>Harbourfield Foods Group</li>
                      <li>Bodmin Bakery</li>
                      <li>Gemba</li>
                      <li>GEM-214</li>
                    </ol>
                    <p className="editorial-label">Recommendation</p>
                    <p className="editorial-recommend">
                      Link the Gemba finding to an owned action before the next
                      walk.
                    </p>
                    <div className="marketing-governance">
                      <p className="editorial-label">Governance</p>
                      <p className="editorial-authority">
                        A person reviews. A person decides.
                      </p>
                      <p>
                        LeanAI does not publish frameworks, close actions, grant
                        access or purchase site capacity.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="marketing-preview-aux-note">
                  Example data · fictional site
                </p>
                <figcaption>
                  Illustrative assistance inside an open record. LeanAI does not
                  publish standards or decide on its own.
                </figcaption>
              </figure>
              <ScrollReveal delay>
                <MarketingActionCard
                  variant="story"
                  actionRef={SIGNATURE_ACTION.actionRef}
                  title={SIGNATURE_ACTION.title}
                  owner={SIGNATURE_ACTION.owner}
                  due={SIGNATURE_ACTION.due}
                  status="In progress"
                  statusTone="warning"
                  sourceModule={SIGNATURE_ACTION.sourceModule}
                  sourceRef={SIGNATURE_ACTION.sourceRef}
                  sourceTitle={SIGNATURE_ACTION.sourceTitle}
                  leanAiSuggestion={
                    <>
                      Link the Gemba finding to an owned action before the next
                      walk. Context: GEM-214 · Packing Line 1.
                    </>
                  }
                />
              </ScrollReveal>
            </div>
          </div>
        </MarketingContainer>
      </section>

      <section id="faq" className="editorial-section editorial-section-premium">
        <MarketingContainer>
          <div className="editorial-section-head">
            <p className="marketing-kicker">FAQ</p>
            <h2 className="editorial-heading">
              Straight answers — no invented proof
            </h2>
            <p className="editorial-lede">
              Common questions about this page and how to try the product. No
              customer metrics or logos appear here.
            </p>
          </div>
          <div className="editorial-faq">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.id}
                id={item.id}
                className="editorial-faq-item group border border-border/80 bg-elevated/90"
              >
                <summary className="cursor-pointer list-none px-4 py-3.5 text-left text-sm font-semibold text-foreground ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5 sm:py-4 sm:text-[0.9375rem] [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <div className="border-t border-border/60 px-4 pt-0 pb-4 sm:px-5 sm:pb-5">
                  <p className="m-0 pt-3 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                  {item.id === "faq-demo" ? (
                    <p className="mt-3 text-sm">
                      <Link
                        href="/demo"
                        className="font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        {DEMO_BOOKING_CTA}
                      </Link>
                    </p>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </MarketingContainer>
      </section>

      <section
        id="close"
        className="editorial-section editorial-close editorial-close-premium"
      >
        <MarketingContainer>
          <div className="editorial-close-grid">
            <div className="editorial-close-copy editorial-rise">
              <p className="marketing-kicker">Your system</p>
              <h2 className="editorial-display editorial-close-title">
                Your framework. Your standards. Your way of working.
              </h2>
              <p className="editorial-close-platform">
                One connected platform.
              </p>
              <p className="editorial-lede">
                LEH supplies the engine, not the doctrine. One site can start.
                The same framework, standards and permissions extend across the
                organisation.
              </p>
              <div className="editorial-actions">
                <Button asChild className="marketing-cta">
                  <Link href="/demo">{DEMO_BOOKING_CTA}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/signup">Create an account</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
              <p className="editorial-note">
                Book a live demo opens the demonstration page. A meeting is
                confirmed only after the scheduling provider accepts the time
                you choose.
              </p>
            </div>
            <CloseFrameworkVisual />
          </div>
        </MarketingContainer>
      </section>
    </div>
  );
}
