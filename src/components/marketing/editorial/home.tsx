"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_BOOKING_CTA } from "@/lib/marketing/demo-booking";
import {
  MarketingModuleFigure,
  type MarketingModuleId,
} from "@/components/marketing/platform-previews";
import {
  MarketingContainer,
  StatusChip,
} from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";

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

const HERO_PS_STAGES = [
  {
    id: "clarify",
    title: "Clarify",
    caption: "Problem statement",
    state: "complete" as const,
  },
  {
    id: "measure",
    title: "Measure",
    caption: "Evidence & baseline",
    state: "complete" as const,
  },
  {
    id: "analyse",
    title: "Analyse",
    caption: "Root causes",
    state: "current" as const,
  },
  {
    id: "improve",
    title: "Improve",
    caption: "Countermeasures",
    state: "upcoming" as const,
  },
  {
    id: "sustain",
    title: "Sustain",
    caption: "Standards & control",
    state: "upcoming" as const,
  },
] as const;

const HERO_KPIS = [
  { id: "actions", label: "Open actions", value: "12" },
  { id: "cases", label: "Cases in flight", value: "4" },
  { id: "validation", label: "Validations due", value: "2" },
] as const;

function HeroComposition() {
  return (
    <figure className="editorial-stage editorial-hero-os">
      <div className="editorial-hero-os-chrome overflow-hidden rounded-[0.8rem] border border-border bg-elevated shadow-[var(--leh-highlight),var(--marketing-shadow-lift)]">
        <div className="flex items-center gap-2 border-b border-border bg-[color-mix(in_oklab,var(--muted)_65%,var(--elevated))] px-3 py-2 sm:px-3.5">
          <span
            className="editorial-dots inline-flex gap-[0.3rem]"
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </span>
          <p className="min-w-0 truncate text-[0.75rem] font-semibold tracking-wide text-foreground">
            Problem solving · PS-077
          </p>
          <div className="ml-auto shrink-0">
            <StatusChip>Example</StatusChip>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-0 lg:grid-cols-[minmax(7.25rem,9.25rem)_minmax(0,1fr)]">
          <div
            className="border-b border-border bg-[color-mix(in_oklab,var(--muted)_42%,var(--elevated))] p-2 lg:border-r lg:border-b-0"
            role="group"
            aria-label="Example methodology-neutral stages"
          >
            <p className="editorial-context-kicker mb-2 px-0.5 text-[0.62rem] sm:text-[0.68rem]">
              Stages
            </p>
            <ol className="editorial-hero-os-stages m-0 flex [scrollbar-width:none] list-none flex-row gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
              {HERO_PS_STAGES.map((stage, index) => {
                const isLast = index === HERO_PS_STAGES.length - 1;
                return (
                  <li
                    key={stage.id}
                    className={cn(
                      "editorial-hero-os-stage relative min-w-[5.85rem] flex-1 lg:min-w-0 lg:flex-none",
                      !isLast && "lg:pb-2",
                    )}
                  >
                    {!isLast ? (
                      <span
                        className="editorial-hero-os-connector hidden lg:block"
                        aria-hidden="true"
                      />
                    ) : null}
                    <div
                      className={cn(
                        "editorial-hero-os-stage-inner flex h-full flex-col gap-1 rounded-md border px-2 py-1.5 sm:px-2.5 sm:py-2",
                        stage.state === "complete" &&
                          "border-[color-mix(in_oklab,var(--success)_35%,var(--border))] bg-[color-mix(in_oklab,var(--success)_12%,var(--elevated))]",
                        stage.state === "current" &&
                          "editorial-hero-os-stage-current border-primary/35 bg-[color-mix(in_oklab,var(--accent)_70%,var(--elevated))] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent)]",
                        stage.state === "upcoming" &&
                          "border-border/80 bg-[color-mix(in_oklab,var(--muted)_55%,var(--elevated))] opacity-[0.92]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[0.68rem] leading-tight font-semibold tracking-tight text-foreground sm:text-[0.72rem]">
                          {stage.title}
                        </span>
                        {stage.state === "complete" ? (
                          <StatusChip tone="success">Done</StatusChip>
                        ) : null}
                        {stage.state === "current" ? (
                          <span className="editorial-hero-os-pulse">
                            <StatusChip tone="warning">Current</StatusChip>
                          </span>
                        ) : null}
                        {stage.state === "upcoming" ? (
                          <span
                            className="rounded border border-border/80 bg-muted px-1 py-px text-[0.6rem] font-semibold tracking-wide text-muted-foreground uppercase"
                            aria-hidden="true"
                          >
                            ···
                          </span>
                        ) : null}
                      </div>
                      <p className="m-0 text-[0.62rem] leading-snug text-muted-foreground sm:text-[0.65rem]">
                        {stage.caption}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="flex min-w-0 flex-col gap-3 p-3 sm:gap-3.5 sm:p-3.5">
            <div className="min-w-0">
              <p className="editorial-context-kicker">
                Bodmin Bakery · Packing line 1
              </p>
              <h2 className="mt-1 text-base leading-snug font-semibold tracking-tight text-foreground sm:text-lg">
                Recurring film wander after changeovers
              </h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                Methodology-neutral stages · evidence stays with the case
              </p>
            </div>

            <Card className="gap-3 border-primary/20 bg-[color-mix(in_oklab,var(--accent)_45%,var(--card))] p-4 shadow-none sm:p-4">
              <CardHeader className="gap-1 p-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm font-semibold sm:text-[0.9375rem]">
                    LeanAI · proposal
                  </CardTitle>
                  <StatusChip tone="accent">Review</StatusChip>
                </div>
                <p className="text-xs text-muted-foreground">
                  Context · PS-077 · Analyse
                </p>
              </CardHeader>
              <CardContent className="space-y-2 p-0">
                <p className="m-0 text-[0.8125rem] leading-relaxed text-foreground">
                  Add a run chart for film position by changeover batch before
                  moving to countermeasures. A person chooses whether to apply
                  this in the case.
                </p>
                <p className="m-0 text-[0.7rem] leading-normal text-muted-foreground">
                  Publishing and closure stay with a person.
                </p>
              </CardContent>
            </Card>

            <div
              className="grid grid-cols-3 gap-2 border-t border-border/80 pt-3"
              role="group"
              aria-label="Example operational KPIs"
            >
              {HERO_KPIS.map((kpi) => (
                <div
                  key={kpi.id}
                  className="min-w-0 rounded-md border border-border/70 bg-card px-2 py-1.5 text-center sm:px-2.5"
                >
                  <p className="m-0 truncate text-[0.62rem] font-medium tracking-wide text-muted-foreground uppercase sm:text-[0.65rem]">
                    {kpi.label}
                  </p>
                  <p className="m-0 mt-0.5 text-base font-semibold tracking-tight text-foreground tabular-nums sm:text-lg">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption>
        Illustrative product composition. Example records only — Bodmin Bakery
        is a fictional site.
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
    <div className="editorial-story">
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

      <article
        id="finding-record"
        className="editorial-record"
        aria-labelledby={`finding-step-${active.id}`}
        key={active.id}
      >
        <div className="editorial-record-head">
          <div>
            <p className="editorial-record-ref">{active.ref}</p>
            <h3>{active.recordTitle}</h3>
          </div>
          <StatusChip tone={active.tone}>{active.status}</StatusChip>
        </div>
        <ol className="editorial-chain" aria-label="Connected records">
          {LINEAGE.map((step) => (
            <li
              key={step.ref}
              data-current={step.id === active.id || undefined}
            >
              {step.ref}
            </li>
          ))}
        </ol>
        <dl className="editorial-fields">
          {active.fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="editorial-record-foot">
          Same system · Harbourfield Foods Group — Bodmin Bakery ·{" "}
          {active.module}
        </p>
      </article>
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
            <div className="editorial-rise editorial-rise-delay">
              <HeroComposition />
            </div>
          </div>
          <p className="editorial-principle">
            <strong>One connected platform.</strong>
            <span>Your framework, your standards, your way of working.</span>
          </p>
        </MarketingContainer>
      </section>

      <section id="why" className="editorial-section editorial-band">
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
          <FindingStory />
        </MarketingContainer>
      </section>

      <section id="platform" className="editorial-section">
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
          <ol className="editorial-modules">
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

      <section id="leanai" className="editorial-section editorial-band">
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

            <figure className="editorial-assistant">
              <div className="marketing-preview">
                <div className="marketing-preview-chrome">
                  <p className="marketing-preview-title">LeanAI</p>
                  <StatusChip tone="accent">Contextual assistant</StatusChip>
                </div>
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
              <figcaption>
                Illustrative assistance inside an open record. LeanAI does not
                publish standards or decide on its own.
              </figcaption>
            </figure>
          </div>
        </MarketingContainer>
      </section>

      <section id="close" className="editorial-section editorial-close">
        <MarketingContainer>
          <p className="marketing-kicker">Your system</p>
          <h2 className="editorial-display editorial-close-title">
            Your framework. Your standards. Your way of working.
          </h2>
          <p className="editorial-close-platform">One connected platform.</p>
          <p className="editorial-lede">
            LEH supplies the engine, not the doctrine. One site can start. The
            same framework, standards and permissions extend across the
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
            confirmed only after the scheduling provider accepts the time you
            choose.
          </p>
        </MarketingContainer>
      </section>
    </div>
  );
}
