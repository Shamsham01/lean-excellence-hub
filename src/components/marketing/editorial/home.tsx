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

import "./home.css";

const copy = landingCopy;
const captures = {
  phone: ["v1-maturity-phone-light", 1170, 2532],
  audit: ["v2-five-s-raise-phone-dark", 1170, 2532],
  case: ["v3-pps-case-desktop-dark", 2400, 1600],
  analysis: ["v3b-pps-analysis-desktop-dark", 2400, 1600],
  action: ["v4-actions-planner-desktop-dark", 2400, 1600],
  dashboard: ["v5-dashboard-home-desktop-dark", 2400, 1200],
  finding: ["v6-gemba-finding-dark", 2400, 1600],
} as const;

function Capture({
  slot,
  thread = false,
}: {
  slot: keyof typeof captures;
  thread?: boolean;
}) {
  const [basename, width, height] = captures[slot];
  const phone = width < height;
  const src = `/marketing/captures/v2/${basename}`;
  const sizes = phone
    ? "(max-width: 430px) calc(100vw - 3rem), 390px"
    : thread
      ? "(max-width: 767px) 83vw, (max-width: 1280px) 30vw, 390px"
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
        <source srcSet={`${src}.avif`} type="image/avif" sizes={sizes} />
        <Image
          src={`${src}.webp`}
          alt={slot === "phone" ? copy.phoneAlt : ""}
          width={width}
          height={height}
          sizes={sizes}
          loading="lazy"
          unoptimized
        />
      </picture>
      <figcaption>{copy.captions[slot]}</figcaption>
    </figure>
  );
}

function BookingActions({ helper }: { helper: string }) {
  return (
    <div className="editorial-booking">
      <div className="editorial-booking-links">
        <RequestDemoControl />
        <RequestFreeAccessControl />
      </div>
      <p>{helper}</p>
    </div>
  );
}

function Credit() {
  return <p className="editorial-credit">{copy.credit}</p>;
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
            <BookingActions helper={copy.hero.helper} />
          </div>
          <div className="editorial-hero-fragments">
            <MarketingActionCard />
            <AuditSummary />
            <Credit />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="connect">
        <MarketingContainer>
          <SectionIntro {...copy.connect}>
            <p>{copy.connect.intro}</p>
          </SectionIntro>
          <ol
            className="editorial-thread"
            tabIndex={0}
            aria-label={copy.connect.kicker}
          >
            {(["finding", "action", "case"] as const).map((slot, index) => (
              <li key={slot}>
                <p className="editorial-label">{copy.stages[index]}</p>
                <Capture slot={slot} thread />
              </li>
            ))}
          </ol>
          <Credit />
        </MarketingContainer>
      </MarketingSection>

      <div className="editorial-statement">
        <MarketingContainer>
          <p>{copy.statement.title}</p>
          <p>{copy.statement.detail}</p>
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
          <Credit />
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="five-s">
        <MarketingContainer className="editorial-split">
          <SectionIntro {...copy.fiveS}>
            <p>{copy.fiveS.intro}</p>
          </SectionIntro>
          <div>
            <Capture slot="audit" />
            <Credit />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="platform">
        <MarketingContainer>
          <SectionIntro {...copy.platform}>
            <p>{copy.platform.intro}</p>
          </SectionIntro>
          <div className="editorial-platform editorial-visuals">
            <Capture slot="action" />
            <Capture slot="analysis" />
            <AuditSummary />
            <article className="marketing-surface editorial-maturity">
              <h3>{copy.maturity.title}</h3>
              <p className="editorial-score">{copy.maturity.score}</p>
              <p>{copy.maturity.action}</p>
            </article>
          </div>
          <Credit />
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
            <BookingActions helper={copy.close.helper} />
          </div>
          <div>
            <ol className="marketing-surface editorial-structure" role="list">
              {copy.close.structure.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ol>
            <Credit />
          </div>
        </MarketingContainer>
      </MarketingSection>
    </div>
  );
}
