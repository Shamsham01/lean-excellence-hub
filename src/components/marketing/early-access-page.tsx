import { landingCopy } from "@/lib/marketing/landing-copy";

import { EarlyAccessForm } from "./early-access-form";
import {
  MarketingContainer,
  MarketingKicker,
  RequestDemoControl,
} from "./primitives";
import { MarketingShell } from "./shell";

import "./early-access.css";

const copy = landingCopy.access;

export function EarlyAccessPage() {
  return (
    <MarketingShell>
      <section className="lv-access" aria-labelledby="early-access-title">
        <MarketingContainer className="lv-access-grid">
          <div className="lv-access-main">
            <MarketingKicker>{copy.kicker}</MarketingKicker>
            <h1 id="early-access-title" className="lv-access-title">
              {copy.title}
            </h1>
            <p className="lv-access-intro">{copy.intro}</p>
            <EarlyAccessForm />
          </div>
          <aside className="lv-demo-card" aria-labelledby="lv-demo-title">
            <h2 id="lv-demo-title">{copy.demoTitle}</h2>
            <p>{copy.demoLine}</p>
            <RequestDemoControl />
          </aside>
        </MarketingContainer>
      </section>
    </MarketingShell>
  );
}
