import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEMO_BOOKING_CTA,
  GET_FREE_ACCESS_CTA,
  GET_FREE_ACCESS_HREF,
} from "@/lib/marketing/demo-booking";

import { CAPTURES, OPTIONAL_CAPTURES } from "./assets";
import type { BentoTile } from "./content";
import {
  BENTO_ROWS,
  FAQ_ITEMS,
  OVERALL_SCORE,
  PILLARS,
  SCORE_MAX,
} from "./content";
import { GoldenThread } from "./golden-thread";
import { HeroComposite } from "./hero-composite";
import { LeanAiBeats } from "./leanai-beats";
import { MaturityRadar } from "./maturity-radar";
import { V6Motion } from "./motion";
import { ProductWindow } from "./product-window";
import { ThreadCarousel } from "./thread-carousel";

const ROOT_ID = "v6-landing";

function DemoButton({ size = "lg" }: { size?: "lg" | "default" }) {
  return (
    <Button asChild size={size} className="v6-btn v6-btn-primary">
      <Link href="/demo">{DEMO_BOOKING_CTA}</Link>
    </Button>
  );
}

function AccessButton({ size = "lg" }: { size?: "lg" | "default" }) {
  return (
    <Button
      asChild
      size={size}
      variant="outline"
      className="v6-btn v6-btn-secondary"
    >
      <Link href={GET_FREE_ACCESS_HREF}>{GET_FREE_ACCESS_CTA}</Link>
    </Button>
  );
}

function SectionHead({
  kicker,
  title,
  lede,
  id,
}: {
  kicker: string;
  title: string;
  lede?: string;
  id: string;
}) {
  return (
    <div className="v6-head" data-reveal>
      <p className="v6-kicker" data-thread="node">
        {kicker}
      </p>
      <h2 className="v6-h2" id={id}>
        {title}
      </h2>
      {lede ? <p className="v6-lede">{lede}</p> : null}
    </div>
  );
}

/** Landing v6 — "The Golden Thread" (ATELIER art direction, 18 Nov 2026). */
export function V6Landing() {
  return (
    <div className="v6-page" id={ROOT_ID}>
      <V6Motion rootId={ROOT_ID} />
      <GoldenThread rootId={ROOT_ID} />

      {/* 1 · Hero */}
      <section id="connect" className="v6-hero" aria-labelledby="v6-hero-title">
        <div className="v6-hero-aurora" aria-hidden="true" />
        <div className="v6-container v6-hero-grid">
          <div className="v6-hero-copy">
            <p className="v6-kicker" data-thread="node">
              The Continuous Improvement Platform
            </p>
            <h1 className="v6-display" id="v6-hero-title">
              Make continuous improvement visible, accountable and measurable.
            </h1>
            <p className="v6-lede">
              Connect frontline observations, actions, problem solving and
              organisational learning in one platform built around your
              standards.
            </p>
            <div className="v6-ctas">
              <DemoButton />
              <AccessButton />
            </div>
            <a className="v6-text-link" href="#platform">
              Explore the platform
              <ArrowRight aria-hidden="true" className="size-4" />
            </a>
          </div>
          <HeroComposite />
        </div>
      </section>

      {/* 2 · Statement */}
      <section className="v6-statement" aria-label="Positioning statement">
        <div className="v6-container" data-reveal>
          <p className="v6-mega">
            <span className="v6-mega-line">Operational excellence.</span>{" "}
            <span className="v6-mega-line v6-gradient-text">Connected.</span>
          </p>
          <p className="v6-lede v6-statement-sub">
            One spine of evidence — from the floor, through LeanAI, into owned
            actions, to verified results on the dashboard.
          </p>
        </div>
      </section>

      {/* 3 · Golden Thread carousel */}
      <section id="why" className="v6-section" aria-labelledby="v6-why-title">
        <div className="v6-container">
          <SectionHead
            id="v6-why-title"
            kicker="From one finding"
            title="One finding. Every next step connected."
            lede="A quality or operational issue is identified during a Gemba walk. Lean Excellence Hub connects that observation to action, structured problem solving, an improvement project and benefit validation."
          />
          <div className="v6-visual" data-reveal>
            <ThreadCarousel />
          </div>
        </div>
      </section>

      {/* 4 · Action Card */}
      <section
        className="v6-section v6-action"
        aria-labelledby="v6-action-title"
      >
        <div className="v6-container v6-action-grid">
          <div className="v6-action-copy" data-reveal>
            <p className="v6-kicker" data-thread="node">
              The Action Card
            </p>
            <h2 className="v6-h2" id="v6-action-title">
              Accountability you can see on the floor and on the dashboard.
            </h2>
            <p className="v6-lede">
              The same object carries owner, due date, linked source and status
              whether it started on a Gemba walk, a 5S audit or a
              problem-solving case.
            </p>
            <div className="v6-ctas">
              <DemoButton />
            </div>
          </div>
          <div className="v6-action-visual" data-reveal>
            <div className="v6-stage-glow" aria-hidden="true" />
            {/* Desktop drawer from 1024; the phone crop below it. */}
            <ProductWindow
              slot={CAPTURES.actionDetail}
              sizes="(min-width: 1280px) 900px, 100vw"
              className="v6-action-desktop"
            />
            <ProductWindow
              slot={CAPTURES.actionDetailM}
              sizes="420px"
              className="v6-action-mobile"
              style={{ maxWidth: `${CAPTURES.actionDetailM.width / 2}px` }}
            />
          </div>
        </div>
      </section>

      {/* 5 · Platform */}
      <section
        id="platform"
        className="v6-section"
        aria-labelledby="v6-platform-title"
      >
        <div className="v6-container">
          <SectionHead
            id="v6-platform-title"
            kicker="The platform"
            title="One connected improvement system."
            lede="Maturity, frontline evidence, actions, problem solving, projects and capability stay in one operating system. Each area is useful on its own. Together they are how improvement actually runs."
          />

          <div className="v6-visual">
            <article
              id="maturity"
              className="v6-tile v6-maturity"
              data-reveal
              data-radar
            >
              <div className="v6-maturity-radar">
                <h3 className="v6-h3">Maturity</h3>
                <p className="v6-small">Define your operating standard.</p>
                <MaturityRadar />
              </div>
              <div className="v6-maturity-scores">
                <p
                  className="v6-score"
                  aria-label={`Overall maturity ${OVERALL_SCORE} out of ${SCORE_MAX}`}
                >
                  <span className="v6-score-value" data-count={OVERALL_SCORE}>
                    {OVERALL_SCORE.toFixed(1)}
                  </span>
                  <span className="v6-score-max">/ {SCORE_MAX}</span>
                </p>
                <ul className="v6-pillars">
                  {PILLARS.map((p) => (
                    <li key={p.name}>
                      <span className="v6-pillar-name">{p.name}</span>
                      <span className="v6-pillar-score" data-count={p.score}>
                        {p.score.toFixed(1)}
                      </span>
                      <span className="v6-pillar-bar" aria-hidden="true">
                        <i
                          style={{ width: `${(p.score / SCORE_MAX) * 100}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <div className="v6-bento">
              {BENTO_ROWS.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className={`v6-bento-row v6-bento-row-${rowIndex + 1}`}
                >
                  {row.map((tile) => (
                    <article
                      key={tile.id}
                      id={tile.id}
                      className={cn(
                        "v6-tile v6-bento-tile",
                        `v6-tile-${tile.id}`,
                        !tile.slot && !tile.desktop && "is-text-only",
                        tile.desktop && "has-desktop",
                        tile.desktop &&
                          tile.desktop.height / tile.desktop.width ===
                            rowHeightRatio(row) &&
                          rowHeightRatio(row) < BENTO_BLEED_RATIO &&
                          "is-row-short",
                      )}
                      data-reveal
                      style={
                        {
                          "--row-hr": rowHeightRatio(row).toFixed(4),
                        } as CSSProperties
                      }
                    >
                      <div className="v6-tile-head">
                        <h3 className="v6-h3">{tile.name}</h3>
                        <p className="v6-small">{tile.line}</p>
                      </div>
                      {tile.slot || tile.desktop ? (
                        <div className="v6-tile-media">
                          {tile.slot ? (
                            <ProductWindow
                              slot={tile.slot}
                              sizes="420px"
                              className="v6-tile-window is-phone"
                            />
                          ) : null}
                          {tile.desktop ? (
                            <ProductWindow
                              slot={tile.desktop}
                              sizes="(min-width: 1024px) 600px, 1px"
                              className="v6-tile-window is-desktop"
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6 · LeanAI */}
      <section
        id="leanai"
        className="v6-section"
        aria-labelledby="v6-leanai-title"
      >
        <div className="v6-container v6-leanai-grid">
          <div className="v6-leanai-copy">
            <SectionHead
              id="v6-leanai-title"
              kicker="LeanAI"
              title="Context first. Assistance second. You decide."
              lede="LeanAI can find, explain and recommend inside the current organisation, site and workflow. A person reviews. A person decides."
            />
            <LeanAiBeats />
          </div>
          {/* Base: the proposals; ≥1024 the LeanAI panel fragment overlaps it.
              Until the proposals export lands the section is copy-only. */}
          {OPTIONAL_CAPTURES.leanaiProposalsM ? (
            // ATELIER r2 N4: below 768 the phone crop alone.
            <div className="v6-leanai-mobile" data-reveal>
              <ProductWindow
                slot={OPTIONAL_CAPTURES.leanaiProposalsM}
                sizes="390px"
                style={{
                  maxWidth: `${OPTIONAL_CAPTURES.leanaiProposalsM.width / 2}px`,
                }}
              />
            </div>
          ) : null}
          {OPTIONAL_CAPTURES.leanaiProposals ? (
            <div
              className={cn(
                "v6-leanai-visual",
                OPTIONAL_CAPTURES.leanaiFrag && "has-overlay",
              )}
            >
              <div className="v6-stage-glow" aria-hidden="true" />
              <div className="v6-leanai-base" data-reveal>
                <ProductWindow
                  slot={OPTIONAL_CAPTURES.leanaiProposals}
                  sizes="(min-width: 640px) 560px, 100vw"
                />
              </div>
              {OPTIONAL_CAPTURES.leanaiFrag ? (
                <div className="v6-leanai-overlay" data-reveal>
                  <ProductWindow
                    slot={OPTIONAL_CAPTURES.leanaiFrag}
                    sizes="320px"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* 7 · FAQ */}
      <section id="faq" className="v6-section" aria-labelledby="v6-faq-title">
        <div className="v6-container v6-faq-grid">
          <div className="v6-faq-head" data-reveal>
            <p className="v6-kicker" data-thread="node">
              FAQ
            </p>
            <h2 className="v6-h2" id="v6-faq-title">
              Straight answers
            </h2>
          </div>
          <div className="v6-faq-list" data-reveal>
            {FAQ_ITEMS.map((item) => (
              <details key={item.id} id={item.id} className="v6-faq-item">
                <summary>
                  <span>{item.q}</span>
                  <Plus aria-hidden="true" className="v6-faq-icon" />
                </summary>
                <div className="v6-faq-answer">
                  <p>{item.a}</p>
                  {item.link ? (
                    <p>
                      <Link href={item.link.href} className="v6-text-link">
                        {item.link.label}
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    </p>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 8 · Close */}
      <section id="close" className="v6-close" aria-labelledby="v6-close-title">
        <div className="v6-close-art" aria-hidden="true" />
        <div className="v6-container v6-close-inner" data-reveal>
          <div className="v6-close-mark" data-thread="end">
            <ThemedIcon />
          </div>
          <p className="v6-kicker">Your system</p>
          <h2 className="v6-display v6-close-title" id="v6-close-title">
            <span>Your framework.</span> <span>Your standards.</span>{" "}
            <span>Your way of working.</span>
          </h2>
          <p className="v6-lede">One connected platform.</p>
          <div className="v6-ctas v6-ctas-centre">
            <DemoButton />
            <AccessButton />
          </div>
        </div>
      </section>
    </div>
  );
}

function ThemedIcon() {
  return (
    <>
      <img
        src="/brand/leh-icon-light.svg"
        alt=""
        width={96}
        height={96}
        className="cap-light v6-close-icon"
      />
      <img
        src="/brand/leh-icon-dark.svg"
        alt=""
        width={96}
        height={96}
        className="cap-dark v6-close-icon"
      />
    </>
  );
}

/** ≥1024 the bento media box is 0.6 × the window width (the bleed). */
const BENTO_BLEED_RATIO = 0.6;

/**
 * ATELIER r4 P1: a row's media box is never taller than its shortest -d
 * capture, so a short capture (Training, ~3:1) leaves no gap and the tiles in
 * the row stay equal height.
 */
function rowHeightRatio(row: readonly BentoTile[]): number {
  const ratios = row
    .map((tile) => tile.desktop)
    .filter((slot): slot is NonNullable<typeof slot> => slot !== null)
    .map((slot) => slot.height / slot.width);
  return Math.min(BENTO_BLEED_RATIO, ...ratios);
}
