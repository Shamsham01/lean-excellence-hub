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

/** Three-column poster. Columns stay clear of each other during the hold. */
const FRAGMENT_POSTER = [
  { col: 1, row: 2, s: 1.02, ox: 2, oy: 2 },
  { col: 3, row: 2, s: 1.28, ox: -2, oy: 2 },
  { col: 2, row: 3, s: 1.12, ox: 1, oy: 1 },
  { col: 3, row: 3, s: 0.96, ox: -2, oy: 1 },
  { col: 1, row: 3, s: 1.08, ox: 2, oy: 0 },
  { col: 1, row: 4, s: 1.16, ox: 2, oy: -1 },
  { col: 2, row: 4, s: 0.88, ox: 1, oy: -1 },
  { col: 3, row: 4, s: 1.24, ox: -2, oy: -1 },
  { col: 1, row: 5, s: 1.32, ox: 1, oy: -2 },
  { col: 3, row: 5, s: 0.92, ox: -1, oy: -2 },
  { col: 2, row: 5, s: 1.02, ox: 0, oy: -2 },
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
  { id: "context", index: "01", nav: "Context", display: "Context" },
  { id: "understand", index: "02", nav: "Understand", display: "Understand" },
  { id: "connect", index: "03", nav: "Connect", display: "Connect" },
  { id: "coach", index: "04", nav: "Coach", display: "Coach" },
  { id: "recommend", index: "05", nav: "Recommend", display: "Recommend" },
  { id: "authority", index: "06", nav: "You decide", display: "You decide" },
] as const;

const FINALE_TILES = [
  { fx: "-78", fy: "-48", cobalt: false },
  { fx: "72", fy: "-62", cobalt: false },
  { fx: "-68", fy: "56", cobalt: false },
  { fx: "84", fy: "52", cobalt: true },
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
  phase,
}: {
  word: string;
  seed: number;
  phase: "operational" | "excellence" | "connected";
}) {
  return (
    <span className="kinetic-hero-line" data-hero-line={phase}>
      {word.split("").map((character, index) => (
        <span
          key={`${word}-${index}`}
          className="kinetic-hero-glyph"
          style={
            {
              "--gx": ((unit(seed + index) - 0.5) * 14).toFixed(2),
              "--gy": ((unit(seed + index + 8) - 0.5) * 10).toFixed(2),
              "--gr": ((unit(seed + index + 3) - 0.5) * 8).toFixed(2),
              "--sd": (0.15 + unit(seed + index + 11) * 0.7).toFixed(3),
            } as CSSProperties
          }
        >
          {character}
        </span>
      ))}
      {phase === "connected" ? (
        <>
          <HeroPunct />
          <span className="kinetic-hero-baseline" aria-hidden="true" />
        </>
      ) : null}
    </span>
  );
}

function HeroPunct() {
  return (
    <span className="kinetic-hero-punct" aria-hidden="true">
      <span className="kinetic-hero-square" />
      <span className="kinetic-hero-tile kinetic-hero-tile-tl" />
      <span className="kinetic-hero-tile kinetic-hero-tile-tr" />
      <span className="kinetic-hero-tile kinetic-hero-tile-bl" />
      <i className="kinetic-hero-bridge kinetic-hero-bridge-top" />
      <i className="kinetic-hero-bridge kinetic-hero-bridge-mid" />
      <i className="kinetic-hero-bridge kinetic-hero-bridge-left" />
      <i className="kinetic-hero-bridge kinetic-hero-bridge-right" />
    </span>
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
          const poster = FRAGMENT_POSTER[group.wordIndex] ?? {
            col: 1,
            row: 1,
            s: 1,
            ox: 0,
            oy: 0,
          };
          const { word, glyphs, start } = group;

          return (
            <span
              key={word}
              className="kinetic-word"
              style={
                {
                  "--col": String(poster.col),
                  "--row": String(poster.row),
                  "--scale": String(poster.s),
                  "--ox": String(poster.ox),
                  "--oy": String(poster.oy),
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
                        "--sx": ((unit(seed) - 0.5) * 78).toFixed(2),
                        "--sy": ((unit(seed + 19) - 0.5) * 48).toFixed(2),
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
        length={186}
        lengthSm={132}
      >
        <div className="kinetic-stage kinetic-hero-stage">
          <p className="kinetic-anno">01 / Connect</p>
          <p className="kinetic-kicker">
            The operating system for Continuous Improvement
          </p>
          <h1 id="connect-title" className="kinetic-hero-title">
            <span className="sr-only">Operational excellence. Connected.</span>
            <span className="kinetic-hero-visual" aria-hidden="true">
              <HeroLine word="OPERATIONAL" seed={4} phase="operational" />
              <HeroLine word="EXCELLENCE." seed={28} phase="excellence" />
              <HeroLine word="CONNECTED" seed={52} phase="connected" />
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
        length={320}
        lengthSm={220}
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
        length={500}
        lengthSm={120}
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
            <p>01 Context</p>
            <ul>
              <li>Organisation</li>
              <li>Site</li>
              <li>Role where permitted</li>
              <li>Current workflow</li>
              <li>Open record</li>
              <li>Relevant framework</li>
            </ul>
            <p>02 Understand</p>
            <p>
              LeanAI understands where the user is and what the workflow is for.
            </p>
            <p>03 Connect</p>
            <p>
              It can bring related work and the organisation&apos;s current
              standard into the conversation.
            </p>
            <p>04 Coach</p>
            <p>
              It explains the next governed step and helps the user operate and
              set up the platform.
            </p>
            <p>05 Recommend</p>
            <p>
              Example recommendation: link the Gemba finding to an owned action
              before the next walk.
            </p>
            <p>06 You decide</p>
            <p>A person reviews. A person decides.</p>
            <p>
              LeanAI does not publish frameworks, close actions, grant access or
              purchase site capacity.
            </p>
          </div>
          <div className="kinetic-leanai-board" aria-hidden="true">
            <ol className="kinetic-lean-nav">
              {LEAN_CHAPTERS.map((chapter, index) => (
                <li
                  key={chapter.id}
                  style={{ ["--b" as string]: `var(--b${index})` }}
                >
                  <span>{chapter.index}</span> {chapter.nav}
                </li>
              ))}
            </ol>
            <div className="kinetic-lean-main">
              <div className="kinetic-lean-titles">
                {LEAN_CHAPTERS.map((chapter, index) => (
                  <p
                    key={chapter.id}
                    className="kinetic-lean-title"
                    data-lean-title={chapter.id}
                    style={{ ["--b" as string]: `var(--b${index})` }}
                  >
                    {chapter.display}
                  </p>
                ))}
              </div>
              <div className="kinetic-live">
                <div
                  data-lean-panel="context"
                  style={{ ["--b" as string]: "var(--b0)" }}
                >
                  <p className="kinetic-panel-label">Context</p>
                  <p className="kinetic-context" data-leanai-context />
                </div>
                <div
                  data-lean-panel="understand"
                  style={{ ["--b" as string]: "var(--b1)" }}
                >
                  <p className="kinetic-panel-label">Understand</p>
                  <p className="kinetic-beat-copy">
                    LeanAI understands where the user is and what the workflow
                    is for.
                  </p>
                </div>
                <div
                  data-lean-panel="connect"
                  style={{ ["--b" as string]: "var(--b2)" }}
                >
                  <p className="kinetic-panel-label">Connect</p>
                  <p className="kinetic-beat-copy">
                    It can bring related work and the organisation&apos;s
                    current standard into the conversation.
                  </p>
                </div>
                <div
                  data-lean-panel="coach"
                  style={{ ["--b" as string]: "var(--b3)" }}
                >
                  <p className="kinetic-panel-label">Coach</p>
                  <p className="kinetic-beat-copy">
                    It explains the next governed step and helps the user
                    operate and set up the platform.
                  </p>
                </div>
                <div
                  data-lean-panel="recommend"
                  style={{ ["--b" as string]: "var(--b4)" }}
                >
                  <p className="kinetic-panel-label">Recommend</p>
                  <p className="kinetic-recommend" data-leanai-recommend />
                  <p className="kinetic-reject" data-leanai-reject />
                </div>
                <div
                  data-lean-panel="authority"
                  style={{ ["--b" as string]: "var(--b5)" }}
                >
                  <p className="kinetic-panel-label">You decide</p>
                  <p className="kinetic-authority">
                    A person reviews. A person decides.{" "}
                    <span className="kinetic-governance">
                      LeanAI does not independently publish frameworks, close
                      actions, grant access or purchase site capacity.
                    </span>
                  </p>
                </div>
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
