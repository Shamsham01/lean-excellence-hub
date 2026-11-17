import { landingCopy } from "@/lib/marketing/landing-copy";

import { HeroStatusCycle } from "./hero-status-cycle";

export function MarketingActionCard() {
  const { action, captions } = landingCopy;

  return (
    <article
      className="marketing-surface editorial-action-card"
      aria-labelledby="hero-action-title"
    >
      <div className="editorial-action-header">
        <p className="editorial-label">{action.label}</p>
        <HeroStatusCycle />
      </div>
      <h3 id="hero-action-title">{captions.action}</h3>
      <dl>
        <div>
          <dt>{action.sourceLabel}</dt>
          <dd>{captions.finding}</dd>
        </div>
        <div>
          <dt>{action.ownerLabel}</dt>
          <dd>{action.owner}</dd>
        </div>
      </dl>
    </article>
  );
}
