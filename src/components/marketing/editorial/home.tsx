"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

import {
  DEMO_BOOKING_CTA,
  GET_FREE_ACCESS_CTA,
  GET_FREE_ACCESS_HREF,
} from "@/lib/marketing/demo-booking";
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
import { LineageCarousel } from "./thread-carousel";

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
    id: "faq-access",
    q: "How do I get free access?",
    a: "Use Get free access and tell us about your site. Lean Excellence Hub is in early access, so we set it up with you.",
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
    </figure>
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
                Your organisation
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
    </figure>
  );
}

const CAPTURES = {
  audit: {
    file: "v2-five-s-raise-phone-dark",
    width: 1009,
    height: 2100,
    variants: [600],
    alt: "A 5S audit on a phone, raising an action with an owner, a due date and labels.",
  },
  case: {
    file: "v3-pps-case-desktop-dark",
    width: 2029,
    height: 1490,
    variants: [800, 1400],
    alt: "A problem-solving case on the eight-step rail at Root Cause Analysis, with LeanAI proposals to accept, edit or reject.",
  },
  analysis: {
    file: "v3b-pps-analysis-desktop-dark",
    width: 2282,
    height: 1231,
    variants: [800, 1400],
    alt: "A problem-solving cause analysis with LeanAI proposals to accept, edit or reject.",
  },
  action: {
    file: "v4-actions-planner-desktop-dark",
    width: 2135,
    height: 1482,
    variants: [800, 1400],
    alt: "The actions planner as a board, with open, in-progress and completed actions.",
  },
  dashboard: {
    file: "v5-dashboard-home-desktop-dark",
    width: 2282,
    height: 1336,
    variants: [800, 1400],
    alt: "The platform home with items needing attention and operational analytics tiles.",
  },
  finding: {
    file: "v6-gemba-finding-dark",
    width: 2231,
    height: 1482,
    variants: [800, 1400],
    alt: "A completed Gemba walk with its summary, an issue observation and the answer recorded on Packing Line 1.",
  },
  results: {
    file: "v7-maturity-results-desktop-dark",
    width: 2010,
    height: 1482,
    variants: [800, 1400],
    alt: "A published maturity result with the overall score, maturity levels and five pillar scores.",
  },
} as const;

type CaptureSlot = keyof typeof CAPTURES;

/** One capture per finding-story step, in carousel order. */
const STORY_CAPTURE = {
  observe: "finding",
  act: "action",
  solve: "case",
  improve: "dashboard",
} as const satisfies Record<string, CaptureSlot>;

/** Platform modules that show a product capture instead of a vignette. */
const MODULE_CAPTURE = {
  maturity: "results",
  "problem-solving": "analysis",
} as const satisfies Partial<Record<MarketingModuleId, CaptureSlot>>;

function srcSet(slot: CaptureSlot, extension: "avif" | "webp") {
  const { file, width, variants } = CAPTURES[slot];
  const base = `/marketing/captures/v4/${file}`;
  return [
    ...variants.map((w) => `${base}-${w}w.${extension} ${w}w`),
    `${base}.${extension} ${width}w`,
  ].join(", ");
}

/** A product capture shown whole, at its natural aspect ratio. */
function Capture({
  slot,
  carousel = false,
}: {
  slot: CaptureSlot;
  carousel?: boolean;
}) {
  const { file, width, height, alt } = CAPTURES[slot];
  const phone = width < height;
  const sizes = phone
    ? "(max-width: 430px) 70vw, 300px"
    : carousel
      ? "(max-width: 767px) 86vw, (max-width: 1280px) 76vw, 1000px"
      : "(max-width: 1023px) 92vw, 760px";

  return (
    <figure
      className={
        phone
          ? "editorial-capture editorial-capture-phone"
          : "editorial-capture"
      }
    >
      <picture>
        <source srcSet={srcSet(slot, "avif")} type="image/avif" sizes={sizes} />
        <source srcSet={srcSet(slot, "webp")} type="image/webp" sizes={sizes} />
        <Image
          src={`/marketing/captures/v4/${file}.webp`}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          loading={carousel ? "eager" : "lazy"}
          unoptimized
          style={{ aspectRatio: `${width} / ${height}` }}
        />
      </picture>
    </figure>
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
          </div>
          <ScrollReveal>
            <LineageCarousel label="From one finding" steps={LINEAGE}>
              {LINEAGE.map((step) => (
                <li key={step.id} aria-labelledby={`finding-step-${step.id}`}>
                  <Capture
                    slot={STORY_CAPTURE[step.id as keyof typeof STORY_CAPTURE]}
                    carousel
                  />
                </li>
              ))}
            </LineageCarousel>
          </ScrollReveal>
        </MarketingContainer>
      </section>

      <section
        className="editorial-statement editorial-statement-evidence"
        aria-label="Product evidence"
      >
        <MarketingContainer>
          <ScrollReveal delay>
            <div className="editorial-statement-grid editorial-statement-grid-capture">
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
              <Capture slot="audit" />
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
                {module.id in MODULE_CAPTURE ? (
                  <Capture
                    slot={
                      MODULE_CAPTURE[module.id as keyof typeof MODULE_CAPTURE]
                    }
                  />
                ) : (
                  <MarketingModuleFigure id={module.id} />
                )}
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
                  <Link href={GET_FREE_ACCESS_HREF}>{GET_FREE_ACCESS_CTA}</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>
            <CloseFrameworkVisual />
          </div>
        </MarketingContainer>
      </section>
    </div>
  );
}
