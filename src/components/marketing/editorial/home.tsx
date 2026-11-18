"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DEMO_BOOKING_CTA,
  GET_FREE_ACCESS_CTA,
  GET_FREE_ACCESS_HREF,
} from "@/lib/marketing/demo-booking";
import type { MarketingModuleId } from "@/components/marketing/platform-previews";
import { MarketingContainer } from "@/components/marketing/primitives";
import {
  MarketingActionCard,
  MarketingGembaFindingCard,
} from "./marketing-action-card";
import { ScrollReveal } from "./scroll-reveal";
import { Capture, type CaptureSlot } from "./captures";
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

/** One capture per finding-story step, in carousel order. */
const STORY_CAPTURE = {
  observe: "observe",
  act: "act",
  solve: "solve",
  improve: "improve",
  learn: "learn",
} as const satisfies Record<string, CaptureSlot>;

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
        className="dark marketing-dark-band editorial-section editorial-band editorial-section-premium"
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
                  <div className="editorial-slide">
                    <Capture
                      slot={
                        STORY_CAPTURE[step.id as keyof typeof STORY_CAPTURE]
                      }
                      eager
                      dark
                      sizes="(max-width: 767px) 86vw, (max-width: 1280px) 76vw, 1000px"
                    />
                  </div>
                </li>
              ))}
            </LineageCarousel>
          </ScrollReveal>
        </MarketingContainer>
      </section>

      <section
        className="dark marketing-dark-band editorial-statement editorial-statement-evidence"
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
              <Capture slot="raise" dark />
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
              <li key={module.id} id={module.id} className="editorial-module">
                <div className="editorial-module-copy">
                  <p className="editorial-module-index">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3>{module.name}</h3>
                  <p>{module.line}</p>
                </div>
                <Capture slot={module.id} />
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
              <Capture slot="leanai" />
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
            <div className="editorial-close-visual editorial-rise editorial-rise-delay">
              <Capture slot="organisation" />
            </div>
          </div>
        </MarketingContainer>
      </section>
    </div>
  );
}
