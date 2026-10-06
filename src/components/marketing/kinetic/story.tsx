"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import {
  MarketingModuleFigure,
  type MarketingModuleId,
} from "@/components/marketing/platform-previews";

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

const FRAGMENT_WORDS = [
  "Spreadsheet",
  "Email",
  "Audit",
  "Action",
  "Training",
  "Project",
  "Suggestion",
  "Gemba",
  "5S",
  "Benefits",
  "Maturity",
] as const;

const FRAGMENT_HOME = [
  [-18, 2],
  [2, -2],
  [18, 4],
  [-16, 12],
  [4, 14],
  [20, 10],
  [-18, 22],
  [0, 20],
  [18, 22],
  [26, 8],
  [-6, 24],
] as const;

const FRAGMENT_SLOTS = [
  [-24, 6],
  [-8, 6],
  [8, 6],
  [24, 6],
  [-22, 15],
  [-6, 15],
  [10, 15],
  [24, 15],
  [-14, 24],
  [2, 24],
  [18, 24],
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

const LEAN_CHAPTERS = [
  {
    id: "context",
    index: "01",
    title: "Context",
    line: "Organisation, site, permitted role, workflow, open record, framework.",
  },
  {
    id: "understand",
    index: "02",
    title: "Understand",
    line: "Where you are, and what this workflow is for.",
  },
  {
    id: "connect",
    index: "03",
    title: "Connect",
    line: "Related work and the organisation's standard.",
  },
  {
    id: "coach",
    index: "04",
    title: "Coach",
    line: "The next step, explained. The change stays yours.",
  },
  {
    id: "recommend",
    index: "05",
    title: "Recommend",
    line: "A governed next action. Not an automatic decision.",
  },
  {
    id: "authority",
    index: "06",
    title: "A person decides",
    line: "A person reviews. A person decides.",
  },
] as const;

const FINALE_TILES = [
  { fx: "-168", fy: "-96", cobalt: false },
  { fx: "154", fy: "-128", cobalt: false },
  { fx: "-142", fy: "118", cobalt: false },
  { fx: "176", fy: "104", cobalt: true },
] as const;

function unit(index: number) {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function KineticActions({ finale = false }: { finale?: boolean }) {
  return (
    <div className="kinetic-actions">
      <Link className="kinetic-btn kinetic-btn-primary" href="/demo">
        Request a demo
      </Link>
      <Link className="kinetic-btn kinetic-btn-secondary" href="/signup">
        Create account
      </Link>
      {finale ? (
        <Link className="kinetic-btn kinetic-btn-secondary" href="/login">
          Sign in
        </Link>
      ) : (
        <a className="kinetic-btn kinetic-btn-secondary" href="#platform">
          Explore the platform
        </a>
      )}
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

function HeroLine({
  word,
  seed,
  measure = false,
}: {
  word: string;
  seed: number;
  measure?: boolean;
}) {
  return (
    <span
      className="kinetic-hero-line"
      {...(measure ? { "data-hero-line": "operational" } : {})}
    >
      {word.split("").map((character, index) => (
        <span
          key={`${word}-${index}`}
          className="kinetic-hero-glyph"
          style={
            {
              "--gx": ((unit(seed + index) - 0.5) * 8).toFixed(2),
              "--gy": ((unit(seed + index + 8) - 0.5) * 6).toFixed(2),
            } as CSSProperties
          }
        >
          {character}
        </span>
      ))}
    </span>
  );
}

function HeroMark() {
  return (
    <svg
      className="kinetic-hero-mark"
      data-hero-mark
      viewBox="0 0 46 46"
      aria-hidden="true"
    >
      <rect
        x="0.8"
        y="0.8"
        width="17.2"
        height="17.2"
        rx="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="28"
        y="0.8"
        width="17.2"
        height="17.2"
        rx="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="0.8"
        y="28"
        width="17.2"
        height="17.2"
        rx="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect x="28" y="28" width="17.2" height="17.2" rx="3.2" fill="#2759a2" />
      <rect x="18" y="8.2" width="10" height="2" fill="currentColor" />
      <rect x="8.2" y="18" width="2" height="10" fill="currentColor" />
      <rect x="35.8" y="18" width="2" height="10" fill="currentColor" />
      <rect x="18" y="35.8" width="10" height="2" fill="currentColor" />
    </svg>
  );
}

const FRAGMENT_GLYPHS = FRAGMENT_WORDS.map((word, wordIndex, words) => ({
  word,
  wordIndex,
  glyphs: word.toUpperCase().split(""),
  start: words
    .slice(0, wordIndex)
    .reduce((count, earlier) => count + earlier.length, 0),
}));

function FragmentField() {
  return (
    <div className="kinetic-fragment-field">
      <ul className="sr-only">
        {FRAGMENT_WORDS.map((word) => (
          <li key={word}>{word}</li>
        ))}
      </ul>
      <div className="kinetic-glyph-stage" aria-hidden="true">
        {FRAGMENT_GLYPHS.map((group) => {
          const slot = FRAGMENT_SLOTS[group.wordIndex] ?? [0, 0];
          const home = FRAGMENT_HOME[group.wordIndex] ?? [0, 0];
          const { word, glyphs, start } = group;

          return (
            <span
              key={word}
              className="kinetic-word"
              style={
                {
                  "--wx": String(home[0]),
                  "--wy": String(home[1]),
                  "--tx": String(slot[0]),
                  "--ty": String(slot[1]),
                } as CSSProperties
              }
            >
              {glyphs.map((character, index) => {
                const seed = start + index;
                return (
                  <span
                    key={`${word}-${index}`}
                    className="kinetic-glyph"
                    style={
                      {
                        "--sx": ((unit(seed) - 0.5) * 58).toFixed(2),
                        "--sy": ((unit(seed + 19) - 0.5) * 32).toFixed(2),
                        "--sr": ((unit(seed + 31) - 0.5) * 28).toFixed(2),
                        "--ss": (0.84 + unit(seed + 47) * 0.32).toFixed(3),
                        "--sd": (unit(seed + 61) * 0.52).toFixed(3),
                      } as CSSProperties
                    }
                  >
                    {character}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>
      <p className="kinetic-resolve" aria-hidden="true">
        ONE CONNECTED
        <br />
        IMPROVEMENT SYSTEM.
      </p>
      <p className="sr-only">One connected improvement system.</p>
      <span className="kinetic-bridge" aria-hidden="true" />
    </div>
  );
}

function FinaleMark() {
  return (
    <div className="kinetic-finale-mark" data-finale-mark aria-hidden="true">
      <span
        className="kinetic-finale-tile"
        style={
          {
            "--fx": FINALE_TILES[0].fx,
            "--fy": FINALE_TILES[0].fy,
          } as CSSProperties
        }
      />
      <i className="kinetic-finale-bridge kinetic-finale-bridge-h" />
      <span
        className="kinetic-finale-tile"
        style={
          {
            "--fx": FINALE_TILES[1].fx,
            "--fy": FINALE_TILES[1].fy,
          } as CSSProperties
        }
      />
      <i className="kinetic-finale-bridge kinetic-finale-bridge-v" />
      <span className="kinetic-finale-gap" />
      <i className="kinetic-finale-bridge kinetic-finale-bridge-v" />
      <span
        className="kinetic-finale-tile"
        style={
          {
            "--fx": FINALE_TILES[2].fx,
            "--fy": FINALE_TILES[2].fy,
          } as CSSProperties
        }
      />
      <i className="kinetic-finale-bridge kinetic-finale-bridge-h" />
      <span
        className="kinetic-finale-tile kinetic-finale-fill"
        data-finale-tile
        style={
          {
            "--fx": FINALE_TILES[3].fx,
            "--fy": FINALE_TILES[3].fy,
          } as CSSProperties
        }
      />
    </div>
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
        length={148}
        lengthSm={124}
      >
        <div className="kinetic-stage kinetic-hero-stage">
          <p className="kinetic-anno">01 / Connect</p>
          <p className="kinetic-kicker">
            The operating system for Continuous Improvement
          </p>
          <h1 id="connect-title" className="kinetic-hero-title">
            <span className="sr-only">Operational excellence. Connected.</span>
            <span className="kinetic-hero-visual" aria-hidden="true">
              <HeroLine word="OPERATIONAL" seed={4} measure />
              <HeroLine word="EXCELLENCE" seed={28} />
              <span className="kinetic-hero-line kinetic-hero-line-final">
                <span className="kinetic-hero-stretch" data-hero-stretch>
                  <span data-hero-stretch-inner>CONNECTED</span>
                </span>
                <HeroMark />
              </span>
            </span>
          </h1>
          <p className="kinetic-lede">
            Connect frontline evidence to owned action, structured solving,
            validated benefits and organisational learning — in one Continuous
            Improvement system.
          </p>
          <KineticActions />
        </div>
      </KineticScene>

      <KineticScene
        id="why"
        kinetic="fragments"
        tone="ink"
        length={268}
        lengthSm={196}
      >
        <div className="kinetic-stage kinetic-fragment-stage">
          <div className="kinetic-fragment-copy">
            <p className="kinetic-anno">02 / Fragments</p>
            <h2 id="why-title" className="kinetic-statement">
              Improvement shouldn&apos;t live in fragments.
            </h2>
          </div>
          <FragmentField />
        </div>
      </KineticScene>

      <KineticScene
        id="loop"
        kinetic="loop"
        tone="paper"
        length={220}
        lengthSm={176}
      >
        <div className="kinetic-stage kinetic-loop-stage">
          <p className="kinetic-anno">03 / Loop</p>
          <h2 id="loop-title" className="kinetic-statement">
            A connected loop, not a pile of modules.
          </h2>
          <div className="kinetic-loop-baseline" aria-hidden="true">
            <span className="kinetic-loop-forward" />
          </div>
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
          <div className="kinetic-loop-return" aria-hidden="true" />
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
        length={340}
        lengthSm={228}
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
          </div>
          <div className="kinetic-plain">
            <p>Context</p>
            <ul>
              <li>Organisation</li>
              <li>Site</li>
              <li>Role, where permitted</li>
              <li>Current workflow</li>
              <li>Open record</li>
              <li>Relevant framework</li>
            </ul>
            <p>
              LeanAI understands where you are and what this workflow is for.
            </p>
            <p>
              It connects the open record to related work and the
              organisation&apos;s standard.
            </p>
            <p>
              It explains the next step, including how to set up the
              organisation, a site and the operating standards. It will not make
              the change for you.
            </p>
            <p>
              Example recommendation: link the Gemba finding to an owned action
              before the next walk.
            </p>
            <p>A person reviews. A person decides.</p>
            <p>
              LeanAI does not publish frameworks, close actions, grant access or
              purchase site capacity.
            </p>
          </div>
          <div className="kinetic-leanai-board" aria-hidden="true">
            <ol className="kinetic-leanai-chapters">
              {LEAN_CHAPTERS.map((chapter) => (
                <li key={chapter.id} data-lean-beat={chapter.id}>
                  <span className="kinetic-anno">{chapter.index}</span>
                  <strong>{chapter.title}</strong>
                  <p>{chapter.line}</p>
                </li>
              ))}
            </ol>
            <div className="kinetic-live">
              <div data-lean-panel="context">
                <p className="kinetic-panel-label">Context</p>
                <p className="kinetic-context" data-leanai-context />
              </div>
              <div data-lean-panel="understand">
                <p className="kinetic-panel-label">Understand</p>
                <p className="kinetic-beat-copy">
                  LeanAI understands where you are and what this workflow is
                  for.
                </p>
              </div>
              <div data-lean-panel="connect">
                <p className="kinetic-panel-label">Connect</p>
                <p className="kinetic-beat-copy">
                  Related work. The organisation&apos;s standard.
                </p>
              </div>
              <div data-lean-panel="coach">
                <p className="kinetic-panel-label">Coach</p>
                <p className="kinetic-beat-copy">
                  It explains the next step, including setup. It will not make
                  the change for you.
                </p>
              </div>
              <div data-lean-panel="recommend">
                <p className="kinetic-panel-label">Recommend</p>
                <p className="kinetic-recommend" data-leanai-recommend />
                <p className="kinetic-reject" data-leanai-reject />
              </div>
              <div data-lean-panel="authority">
                <p className="kinetic-panel-label">Human authority</p>
                <p className="kinetic-authority" data-leanai-authority />
              </div>
            </div>
          </div>
        </div>
      </KineticScene>

      <KineticScene
        id="close"
        kinetic="close"
        tone="paper"
        length={236}
        lengthSm={176}
      >
        <div className="kinetic-stage kinetic-close-stage">
          <FinaleMark />
          <div className="kinetic-close-copy">
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
            <KineticActions finale />
          </div>
        </div>
      </KineticScene>
    </KineticRoot>
  );
}
