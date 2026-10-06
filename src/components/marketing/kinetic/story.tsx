"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import {
  MarketingModuleFigure,
  type MarketingModuleId,
} from "@/components/marketing/platform-previews";
import { MarketingMark } from "@/components/marketing/primitives";

import { KineticRoot, KineticScene } from "./engine";
import "./kinetic.css";

const RAIL = [
  { id: "connect", index: "01", label: "Connect" },
  { id: "why", index: "02", label: "Fragments" },
  { id: "loop", index: "03", label: "Loop" },
  { id: "platform", index: "04", label: "Platform" },
  { id: "leanai", index: "05", label: "LeanAI" },
  { id: "close", index: "06", label: "Your system" },
] as const;

const FRAGMENTS = [
  { label: "Spreadsheet", fx: "-1", fy: "-1", fr: "-6" },
  { label: "Email", fx: "-0.58", fy: "-0.72", fr: "4" },
  { label: "Audit", fx: "-0.18", fy: "-1", fr: "-3" },
  { label: "Action", fx: "0.2", fy: "-0.78", fr: "5" },
  { label: "Training", fx: "0.62", fy: "-0.92", fr: "-4" },
  { label: "Project", fx: "1", fy: "-0.66", fr: "6" },
  { label: "Suggestion", fx: "-1", fy: "0.88", fr: "4" },
  { label: "Gemba", fx: "-0.48", fy: "1", fr: "-5" },
  { label: "5S", fx: "0.02", fy: "0.74", fr: "3" },
  { label: "Benefits", fx: "0.52", fy: "1", fr: "-4" },
  { label: "Maturity", fx: "1", fy: "0.7", fr: "5" },
] as const;

const LOOP = [
  {
    title: "Observe",
    detail: "Gemba / 5S",
    note: "See the work and the standard.",
  },
  {
    title: "Act",
    detail: "Actions / Suggestions",
    note: "Give the response an owner.",
  },
  {
    title: "Solve",
    detail: "Problem Solving",
    note: "Use your method. Keep the evidence.",
  },
  {
    title: "Improve",
    detail: "Projects & Benefits",
    note: "Deliver the change. Validate the value.",
  },
  {
    title: "Learn",
    detail: "Training / Skills / Maturity",
    note: "Capability stays in the system.",
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

function KineticActions() {
  return (
    <div className="kinetic-actions">
      <Link className="kinetic-btn kinetic-btn-primary" href="/demo">
        Request a demo
      </Link>
      <Link className="kinetic-btn kinetic-btn-secondary" href="/signup">
        Create account
      </Link>
      <a className="kinetic-btn kinetic-btn-secondary" href="#platform">
        Explore the platform
      </a>
    </div>
  );
}

function StoryRail() {
  return (
    <nav className="kinetic-rail" aria-label="Story progress">
      {RAIL.map((scene) => (
        <a key={scene.id} href={`/#${scene.id}`} data-scene-link={scene.id}>
          <span className="kinetic-rail-mark" aria-hidden="true">
            <i />
          </span>
          <span className="kinetic-rail-text">
            {scene.index} {scene.label}
          </span>
        </a>
      ))}
    </nav>
  );
}

export function KineticStory() {
  return (
    <KineticRoot>
      <StoryRail />
      <KineticScene
        id="connect"
        kinetic="hero"
        tone="paper"
        length={140}
        lengthSm={118}
      >
        <div className="kinetic-stage">
          <div className="kinetic-hero-layout">
            <div className="kinetic-hero-copy">
              <p className="kinetic-anno">01 / Connect</p>
              <p className="kinetic-kicker">
                The operating system for Continuous Improvement
              </p>
              <h1 id="connect-title" className="kinetic-hero-title">
                <span
                  className="kinetic-hero-line"
                  style={{ "--x": "-26", "--y": "14" } as CSSProperties}
                >
                  Operational
                </span>{" "}
                <span
                  className="kinetic-hero-line"
                  style={{ "--x": "32", "--y": "8" } as CSSProperties}
                >
                  excellence.
                </span>{" "}
                <span
                  className="kinetic-hero-line kinetic-hero-line-final"
                  style={{ "--x": "0", "--y": "24" } as CSSProperties}
                >
                  Connected.
                </span>
              </h1>
              <span className="kinetic-hero-rule" aria-hidden="true" />
              <p className="kinetic-lede">
                Connect frontline evidence to owned action, structured solving,
                validated benefits and organisational learning — in one
                Continuous Improvement system.
              </p>
              <KineticActions />
            </div>
            <div className="kinetic-hero-mark" aria-hidden="true">
              <MarketingMark />
            </div>
          </div>
        </div>
      </KineticScene>

      <KineticScene
        id="why"
        kinetic="fragments"
        tone="ink"
        length={220}
        lengthSm={170}
      >
        <div className="kinetic-stage">
          <p className="kinetic-anno">02 / Fragments</p>
          <h2 id="why-title" className="kinetic-statement">
            Improvement shouldn&apos;t live in fragments.
          </h2>
          <div className="kinetic-fragment-field">
            <ul className="kinetic-fragments" aria-label="Disconnected work">
              {FRAGMENTS.map((item) => (
                <li
                  key={item.label}
                  className="kinetic-fragment"
                  style={
                    {
                      "--fx": item.fx,
                      "--fy": item.fy,
                      "--fr": item.fr,
                    } as CSSProperties
                  }
                >
                  {item.label}
                </li>
              ))}
            </ul>
            <p className="kinetic-resolve">One connected improvement system.</p>
          </div>
        </div>
      </KineticScene>

      <KineticScene
        id="loop"
        kinetic="loop"
        tone="paper"
        length={240}
        lengthSm={188}
      >
        <div className="kinetic-stage">
          <p className="kinetic-anno">03 / Loop</p>
          <h2 id="loop-title" className="kinetic-statement">
            A connected loop, not a pile of modules.
          </h2>
          <p className="kinetic-lede kinetic-muted">
            Frontline evidence becomes owned work, structured solving, delivered
            improvement and organisational learning.
          </p>
          <ol className="kinetic-loop-steps">
            {LOOP.map((step, index) => (
              <li
                key={step.title}
                className="kinetic-loop-step"
                style={{ "--rise": `var(--s${index})` } as CSSProperties}
              >
                <h3>
                  <span className="kinetic-anno" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")} /
                  </span>
                  {step.title}
                </h3>
                <p className="kinetic-loop-detail">{step.detail}</p>
                <p className="kinetic-muted">{step.note}</p>
              </li>
            ))}
          </ol>
          <div className="kinetic-loop-track" aria-hidden="true">
            <span className="kinetic-loop-forward" />
            <span className="kinetic-loop-return" />
          </div>
          <p className="kinetic-loop-caption">
            Learning feeds the next observation. The same records stay
            connected.
          </p>
        </div>
      </KineticScene>

      <KineticScene
        id="platform"
        kinetic="platform"
        tone="ink"
        length={380}
        lengthSm={120}
      >
        <div className="kinetic-stage kinetic-platform-stage">
          <div className="kinetic-platform-head">
            <p className="kinetic-anno">04 / Platform</p>
            <h2 id="platform-title" className="kinetic-platform-title">
              One connected improvement system.
            </h2>
            <p className="kinetic-disclosure">
              Product previews use illustrative example records. They are not
              customer performance data.
            </p>
          </div>
          <div className="kinetic-viewport" data-kinetic-viewport>
            <ol className="kinetic-track" data-kinetic-track>
              {MODULES.map((module, index) => (
                <li
                  key={module.id}
                  className="kinetic-module"
                  data-kinetic-slide
                  data-module-id={module.id}
                  data-focus={index === 0 ? "true" : "false"}
                >
                  <div className="kinetic-module-copy">
                    <p className="kinetic-anno">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3>{module.name}</h3>
                    <p>{module.line}</p>
                  </div>
                  <div className="kinetic-module-preview">
                    <MarketingModuleFigure id={module.id} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <p className="kinetic-aside">
            Scheduling and recognition are part of the same operating system.
          </p>
        </div>
      </KineticScene>

      <KineticScene
        id="leanai"
        kinetic="leanai"
        tone="ink"
        length={230}
        lengthSm={176}
      >
        <div className="kinetic-stage kinetic-leanai-stage">
          <div className="kinetic-leanai-copy">
            <p className="kinetic-anno">05 / LeanAI</p>
            <h2 id="leanai-title" className="kinetic-statement">
              Context first. Assistance second. You decide.
            </h2>
            <p className="kinetic-lede">
              LeanAI can find, explain and recommend inside the current
              organisation, site and workflow. A person reviews. A person
              decides.
            </p>
            <ul className="kinetic-verbs" aria-hidden="true">
              <li style={{ "--verb": "var(--v1)" } as CSSProperties}>Find</li>
              <li style={{ "--verb": "var(--v2)" } as CSSProperties}>
                Explain
              </li>
              <li style={{ "--verb": "var(--v3)" } as CSSProperties}>
                Recommend
              </li>
              <li style={{ "--verb": "var(--v4)" } as CSSProperties}>
                Human decides
              </li>
            </ul>
          </div>
          <div className="kinetic-leanai-panel">
            <div className="kinetic-plain">
              <p>LeanAI sees:</p>
              <ul>
                <li>Organisation</li>
                <li>Site</li>
                <li>Current workflow</li>
                <li>Relevant framework</li>
              </ul>
              <p>
                Example recommendation: link the Gemba finding to an owned
                action before the next walk.
              </p>
              <p>A person reviews. A person decides.</p>
              <p>
                LeanAI does not publish frameworks, close actions, grant access
                or purchase site capacity.
              </p>
            </div>
            <div className="kinetic-live" aria-hidden="true">
              <p className="kinetic-panel-label">Sees</p>
              <p className="kinetic-context" data-leanai-context />
              <p className="kinetic-panel-label">Recommend</p>
              <p className="kinetic-recommend" data-leanai-recommend />
              <p className="kinetic-reject" data-leanai-reject />
              <p className="kinetic-authority" data-leanai-authority />
            </div>
          </div>
        </div>
      </KineticScene>

      <KineticScene
        id="close"
        kinetic="close"
        tone="paper"
        length={210}
        lengthSm={160}
      >
        <div className="kinetic-stage kinetic-close-stage">
          <div className="kinetic-field" aria-hidden="true" />
          <div className="kinetic-close-copy">
            <div className="kinetic-tiles" aria-hidden="true">
              <span
                style={{ "--fx": "-1", "--fy": "-0.85" } as CSSProperties}
              />
              <span style={{ "--fx": "1", "--fy": "-0.7" } as CSSProperties} />
              <span
                style={{ "--fx": "-0.9", "--fy": "0.95" } as CSSProperties}
              />
              <span
                className="kinetic-tile-cobalt"
                style={{ "--fx": "0.95", "--fy": "0.8" } as CSSProperties}
              />
              <i className="kinetic-tile-bridge kinetic-tile-bridge-x" />
              <i className="kinetic-tile-bridge kinetic-tile-bridge-y" />
            </div>
            <p className="kinetic-anno">06 / Your system</p>
            <h2 id="close-title" className="kinetic-statement">
              Your framework. Your standards. Your way of working.
            </h2>
            <p className="kinetic-close-platform">One connected platform.</p>
            <p className="kinetic-lede">
              LEH supplies the engine, not the doctrine. One site can start. The
              same framework, standards and permissions extend across the
              organisation.
            </p>
          </div>
          <div className="kinetic-close-bar">
            <h2>Build a Continuous Improvement system people actually use.</h2>
            <p className="kinetic-muted">
              Connect improvement activity, capability and results in one
              Operational Excellence platform.
            </p>
            <KineticActions />
          </div>
        </div>
      </KineticScene>
    </KineticRoot>
  );
}
