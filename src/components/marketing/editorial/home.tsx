import Image from "next/image";

import { HERO_HEADLINE, landingCopy } from "@/lib/marketing/landing-copy";

import {
  MarketingContainer,
  MarketingSection,
  RequestDemoControl,
  RequestFreeAccessControl,
  SectionIntro,
  StatusChip,
} from "../primitives";
import { MarketingActionCard } from "./marketing-action-card";
import { ThreadCarousel } from "./thread-carousel";

import "./home.css";

const copy = landingCopy;
/**
 * Real product captures (dark, masked, no browser chrome), each shown whole at
 * its natural aspect ratio. Smaller copies sit next to each master as
 * `<basename>-<width>w.<ext>`.
 */
const captures = {
  phone: {
    file: "v1-maturity-phone-dark",
    width: 1170,
    height: 2100,
    variants: [600],
  },
  audit: {
    file: "v2-five-s-raise-phone-dark",
    width: 1009,
    height: 2100,
    variants: [600],
  },
  case: {
    file: "v3-pps-case-desktop-dark",
    width: 2029,
    height: 1490,
    variants: [800, 1400],
  },
  analysis: {
    file: "v3b-pps-analysis-desktop-dark",
    width: 2282,
    height: 1231,
    variants: [800, 1400],
  },
  action: {
    file: "v4-actions-planner-desktop-dark",
    width: 2135,
    height: 1482,
    variants: [800, 1400],
  },
  dashboard: {
    file: "v5-dashboard-home-desktop-dark",
    width: 2282,
    height: 1336,
    variants: [800, 1400],
  },
  finding: {
    file: "v6-gemba-finding-dark",
    width: 2231,
    height: 1482,
    variants: [800, 1400],
  },
  results: {
    file: "v7-maturity-results-desktop-dark",
    width: 2010,
    height: 1482,
    variants: [800, 1400],
  },
} as const;

type CaptureSlot = keyof typeof captures;

function srcSet(slot: CaptureSlot, extension: "avif" | "webp") {
  const { file, width, variants } = captures[slot];
  const base = `/marketing/captures/v4/${file}`;
  return [
    ...variants.map((w) => `${base}-${w}w.${extension} ${w}w`),
    `${base}.${extension} ${width}w`,
  ].join(", ");
}

function Capture({
  slot,
  thread = false,
}: {
  slot: CaptureSlot;
  thread?: boolean;
}) {
  const { file, width, height } = captures[slot];
  const phone = width < height;
  const sizes = phone
    ? "(max-width: 430px) calc(100vw - 3rem), 390px"
    : thread
      ? "(max-width: 767px) 86vw, (max-width: 1280px) 72vw, 900px"
      : "(max-width: 767px) 92vw, (max-width: 1280px) 46vw, 600px";

  return (
    <figure
      className={
        phone
          ? "editorial-capture editorial-capture-phone"
          : "editorial-capture"
      }
    >
      <picture
        className={slot === "phone" ? "editorial-phone-glow" : undefined}
      >
        <source srcSet={srcSet(slot, "avif")} type="image/avif" sizes={sizes} />
        <source srcSet={srcSet(slot, "webp")} type="image/webp" sizes={sizes} />
        <Image
          src={`/marketing/captures/v4/${file}.webp`}
          alt={slot === "phone" ? copy.phoneAlt : copy.alt[slot]}
          width={width}
          height={height}
          sizes={sizes}
          loading="lazy"
          unoptimized
          style={{ aspectRatio: `${width} / ${height}` }}
        />
      </picture>
    </figure>
  );
}

function BookingActions() {
  return (
    <div className="editorial-booking">
      <div className="editorial-booking-links">
        <RequestDemoControl />
        <RequestFreeAccessControl />
      </div>
    </div>
  );
}

function AuditSummary() {
  return (
    <div className="marketing-surface editorial-audit-chip">
      <span>{copy.audit.title}</span>
      <StatusChip tone="warning">{copy.audit.status}</StatusChip>
    </div>
  );
}

export function EditorialHome() {
  return (
    <div className="editorial-home">
      <MarketingSection id="hero">
        <MarketingContainer className="editorial-split">
          <div>
            <h1 className="editorial-headline">{HERO_HEADLINE}</h1>
            <p className="editorial-lede">{copy.hero.lede}</p>
            <BookingActions />
          </div>
          <div className="editorial-hero-fragments">
            <MarketingActionCard />
            <AuditSummary />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="connect">
        <MarketingContainer>
          <SectionIntro {...copy.connect}>
            <p>{copy.connect.intro}</p>
          </SectionIntro>
          <ThreadCarousel label={copy.connect.kicker} stages={copy.stages}>
            {(["finding", "action", "case"] as const).map((slot, index) => (
              <li
                key={slot}
                aria-label={`${index + 1} of 3: ${copy.stages[index]}`}
              >
                <Capture slot={slot} thread />
              </li>
            ))}
          </ThreadCarousel>
        </MarketingContainer>
      </MarketingSection>

      <div className="editorial-statement">
        <MarketingContainer>
          <p>{copy.statement.title}</p>
        </MarketingContainer>
      </div>

      <MarketingSection id="why">
        <MarketingContainer>
          <SectionIntro {...copy.why}>
            <p>{copy.why.intro}</p>
          </SectionIntro>
          <div className="editorial-split editorial-visuals">
            <Capture slot="phone" />
            <Capture slot="dashboard" />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="five-s">
        <MarketingContainer className="editorial-split">
          <SectionIntro {...copy.fiveS}>
            <p>{copy.fiveS.intro}</p>
          </SectionIntro>
          <div>
            <Capture slot="audit" />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="platform">
        <MarketingContainer>
          <SectionIntro {...copy.platform}>
            <p>{copy.platform.intro}</p>
          </SectionIntro>
          <div className="editorial-platform editorial-visuals">
            <Capture slot="results" />
            <Capture slot="analysis" />
            <AuditSummary />
            <article className="marketing-surface editorial-maturity">
              <h3>{copy.maturity.title}</h3>
              <p className="editorial-score">{copy.maturity.score}</p>
              <p>{copy.maturity.action}</p>
            </article>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="leanai">
        <MarketingContainer className="editorial-split">
          <SectionIntro {...copy.leanAI}>
            <p>{copy.leanAI.intro}</p>
          </SectionIntro>
          <ol className="editorial-steps">
            {copy.leanAI.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="faq">
        <MarketingContainer className="editorial-split">
          <SectionIntro {...copy.faq} />
          <div className="editorial-faq">
            {copy.faq.items.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <div>
                  <p>{item.answer}</p>
                  {"access" in item && <RequestFreeAccessControl />}
                </div>
              </details>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <div className="editorial-statement">
        <MarketingContainer>
          <p>{copy.close.title}</p>
        </MarketingContainer>
      </div>

      <MarketingSection id="close">
        <MarketingContainer className="editorial-split">
          <div>
            <SectionIntro {...copy.close}>
              <p>{copy.close.intro}</p>
            </SectionIntro>
            <BookingActions />
          </div>
          <div>
            <ol className="marketing-surface editorial-structure" role="list">
              {copy.close.structure.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ol>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </div>
  );
}
