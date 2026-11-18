import { landingCopy } from "@/lib/marketing/landing-copy";

import { HeroStatusCycle } from "./hero-status-cycle";

export function MarketingActionCard() {
  const { action, records } = landingCopy;

  return (
    <article
      className="marketing-surface editorial-action-card"
      aria-labelledby="hero-action-title"
    >
      <div className="editorial-action-header">
        <p className="editorial-label">{action.label}</p>
        <HeroStatusCycle />
      </div>
      <h2 id="hero-action-title">{records.action}</h2>
      <dl>
        <div>
          <dt>{action.sourceLabel}</dt>
          <dd>{records.finding}</dd>
        </div>
        <div>
          <dt>{action.ownerLabel}</dt>
          <dd>{action.owner}</dd>
        </div>
      </dl>
    </article>
  );
}
