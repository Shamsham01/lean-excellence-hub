"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MarketingModuleFigure,
  type MarketingModuleId,
} from "@/components/marketing/platform-previews";
import {
  MarketingContainer,
  StatusChip,
} from "@/components/marketing/primitives";

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

const HERO_LINKS = [
  {
    ref: "ACT-318",
    title: "Corrective action",
    detail: "Packing supervisor · due Friday",
    status: "Assigned",
    tone: "accent" as const,
  },
  {
    ref: "PS-077",
    title: "Problem solving",
    detail: "CI team · chosen method",
    status: "Cause analysis",
    tone: "accent" as const,
  },
  {
    ref: "PRJ-042",
    title: "Improvement project",
    detail: "Film-path countermeasures",
    status: "Active",
    tone: "connected" as const,
  },
  {
    ref: "BEN-019",
    title: "Benefit",
    detail: "Qualitative · no amount shown",
    status: "Awaiting validation",
    tone: "neutral" as const,
  },
] as const;

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

const WINDOW_NAV = [
  "Gemba",
  "Actions",
  "Problem solving",
  "Projects",
  "Benefits",
] as const;

function HeroWorkspace() {
  return (
    <figure className="editorial-stage">
      <div className="editorial-window">
        <div className="editorial-window-bar">
          <span className="editorial-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <p>Lean Excellence Hub</p>
          <StatusChip>Example</StatusChip>
        </div>
        <div className="editorial-window-body">
          <nav className="editorial-nav" aria-hidden="true">
            <p>Bodmin Bakery</p>
            <ul>
              {WINDOW_NAV.map((item) => (
                <li key={item} data-current={item === "Gemba" || undefined}>
                  {item}
                </li>
              ))}
            </ul>
          </nav>
          <div className="editorial-window-main">
            <p className="editorial-context-kicker">
              Harbourfield Foods Group · Bodmin Bakery · Packing
            </p>
            <div className="editorial-finding">
              <div className="editorial-finding-top">
                <p>GEM-214</p>
                <StatusChip tone="warning">Issue</StatusChip>
              </div>
              <p className="editorial-finding-title">
                Packaging film misaligned on Packing Line 1
              </p>
              <p className="editorial-finding-meta">
                Morning Gemba walk · Packing supervisor · finding recorded
              </p>
            </div>
            <ul className="editorial-links">
              {HERO_LINKS.map((link) => (
                <li key={link.ref}>
                  <p className="editorial-link-ref">{link.ref}</p>
                  <p className="editorial-link-title">{link.title}</p>
                  <p className="editorial-link-detail">{link.detail}</p>
                  <StatusChip tone={link.tone}>{link.status}</StatusChip>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption>
        Illustrative workspace. Harbourfield Foods Group — Bodmin Bakery is a
        fictional site.
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
              <div className="editorial-actions">
                <Button asChild className="marketing-cta">
                  <a href="#platform">
                    Explore the platform
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/signup">Create an account</Link>
                </Button>
              </div>
            </div>
            <div className="editorial-rise editorial-rise-delay">
              <HeroWorkspace />
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
              <Link href="/demo">Request a demo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/signup">Create an account</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="editorial-note">
            Request a demo opens an explanation of the walkthrough. It is not a
            live booking calendar.
          </p>
        </MarketingContainer>
      </section>
    </div>
  );
}
