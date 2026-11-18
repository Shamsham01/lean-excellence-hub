import {
  HERO_HEADLINE,
  HERO_HEADLINE_LINES,
  landingCopy,
} from "@/lib/marketing/landing-copy";

import { EarlyAccessForm } from "../early-access-form";
import {
  GetFreeAccessControl,
  MarketingContainer,
  MarketingSection,
  RequestDemoControl,
  SectionIntro,
} from "../primitives";
import { Capture, captures } from "./captures";

import "./home.css";

const copy = landingCopy;

const DESKTOP_SIZES =
  "(max-width: 767px) calc(100vw - 2.5rem), (max-width: 1280px) 60vw, 760px";
const PHONE_SIZES = "(max-width: 767px) 72vw, 320px";

function HeroActions() {
  return (
    <div className="lv-actions">
      <RequestDemoControl size="lg" />
      <GetFreeAccessControl size="lg" />
    </div>
  );
}

export function EditorialHome() {
  return (
    <div className="editorial-home lv-home">
      <MarketingSection id="hero" className="lv-hero" flush>
        <MarketingContainer className="lv-hero-grid">
          <div className="lv-hero-copy">
            <h1 className="lv-headline" aria-label={HERO_HEADLINE}>
              <span aria-hidden="true">{HERO_HEADLINE_LINES[0]}</span>{" "}
              <span aria-hidden="true">{HERO_HEADLINE_LINES[1]}</span>
            </h1>
            <p className="lv-lede">{copy.hero.lede}</p>
            <HeroActions />
          </div>
          <div className="lv-hero-stage">
            <div className="lv-hero-glow" aria-hidden="true" />
            <div className="lv-hero-desktop">
              <Capture
                asset={captures.dashboard}
                alt={copy.alt.dashboard}
                sizes="(max-width: 1023px) 1px, (max-width: 1440px) 66vw, 960px"
                priority
              />
            </div>
            <Capture
              asset={captures.assessment}
              alt={copy.alt.assessment}
              sizes="(max-width: 1023px) 72vw, 260px"
              className="lv-hero-phone"
              priority
            />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="status-quo" className="lv-status">
        <MarketingContainer>
          <SectionIntro title={copy.statusQuo.title} />
          <ol className="lv-pains">
            {copy.statusQuo.pains.map((pain, index) => (
              <li key={pain}>
                <span className="lv-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p>{pain}</p>
              </li>
            ))}
          </ol>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="platform">
        <MarketingContainer>
          <SectionIntro title={copy.platform.title}>
            <p>{copy.platform.intro}</p>
          </SectionIntro>
          <ul className="lv-modules">
            {copy.platform.modules.map((module) => (
              <li key={module.name}>
                <h3>{module.name}</h3>
                <p>{module.detail}</p>
              </li>
            ))}
          </ul>
          <Capture
            asset={captures.planner}
            alt={copy.alt.planner}
            sizes="(max-width: 767px) calc(100vw - 2.5rem), (max-width: 1280px) 92vw, 1216px"
            className="lv-planner"
          />
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="connect">
        <MarketingContainer>
          <SectionIntro title={copy.connect.title}>
            <p>{copy.connect.intro}</p>
          </SectionIntro>
          <ol
            className="editorial-thread"
            tabIndex={0}
            aria-label={copy.connect.label}
          >
            {(["threadFinding", "threadAction", "threadCase"] as const).map(
              (slot, index) => (
                <li key={slot}>
                  <p className="editorial-label">{copy.stages[index]}</p>
                  <figure className="editorial-capture">
                    <Capture
                      asset={captures[slot]}
                      alt=""
                      sizes="(max-width: 767px) 83vw, (max-width: 1280px) 30vw, 390px"
                    />
                    <figcaption>{copy.stageRecords[index]}</figcaption>
                  </figure>
                </li>
              ),
            )}
          </ol>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="measure">
        <MarketingContainer className="lv-split lv-split-wide">
          <SectionIntro title={copy.measure.title}>
            <p>{copy.measure.intro}</p>
          </SectionIntro>
          <Capture
            asset={captures.results}
            alt={copy.alt.results}
            sizes={DESKTOP_SIZES}
          />
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="floor">
        <MarketingContainer className="lv-split">
          <SectionIntro title={copy.floor.title}>
            <p>{copy.floor.intro}</p>
          </SectionIntro>
          <div className="lv-phones">
            <Capture
              asset={captures.assessment}
              alt={copy.alt.assessment}
              sizes={PHONE_SIZES}
            />
            <Capture
              asset={captures.audit}
              alt={copy.alt.audit}
              sizes={PHONE_SIZES}
              className="lv-dialog-crop"
            />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="leanai">
        <MarketingContainer className="lv-split lv-split-wide">
          <div>
            <SectionIntro title={copy.leanAI.title}>
              <p>{copy.leanAI.intro}</p>
            </SectionIntro>
            <ol className="lv-steps">
              {copy.leanAI.steps.map((step) => (
                <li key={step.name}>
                  <h3>{step.name}</h3>
                  <p>{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
          <Capture
            asset={captures.analysis}
            alt={copy.alt.analysis}
            sizes={DESKTOP_SIZES}
          />
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="faq">
        <MarketingContainer className="lv-split lv-split-top">
          <SectionIntro title={copy.faq.title} />
          <div className="editorial-faq">
            {copy.faq.items.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <div>
                  <p>{item.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="get-free-access" className="lv-access">
        <MarketingContainer className="lv-access-grid">
          <div>
            <SectionIntro title={copy.access.title}>
              <p>{copy.access.intro}</p>
            </SectionIntro>
            <EarlyAccessForm />
          </div>
          <aside className="lv-demo-card" aria-labelledby="lv-demo-title">
            <h3 id="lv-demo-title">{copy.access.demoTitle}</h3>
            <p>{copy.access.demoLine}</p>
            <RequestDemoControl size="lg" />
          </aside>
        </MarketingContainer>
      </MarketingSection>
    </div>
  );
}
