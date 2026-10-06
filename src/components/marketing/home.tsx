import Link from "next/link";

import { Button } from "@/components/ui/button";

import { KineticStory } from "./kinetic/story";
import {
  MarketingContainer,
  MarketingKicker,
  MarketingSection,
  SectionIntro,
} from "./primitives";
import { MarketingShell } from "./shell";

export function MarketingHome() {
  return (
    <MarketingShell>
      <KineticStory />
    </MarketingShell>
  );
}

export function MarketingDemoPage() {
  return (
    <MarketingShell>
      <MarketingSection flush className="marketing-hero">
        <MarketingContainer className="max-w-3xl">
          <MarketingKicker>Request a demo</MarketingKicker>
          <h1 className="marketing-display mt-4">
            See how Lean Excellence Hub can connect your Continuous Improvement
            system.
          </h1>
          <p className="marketing-lede mt-5">
            A demo is a structured walkthrough of the connected operating system
            — not a booking calendar, and not a claim about results you have not
            measured.
          </p>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection className="border-y border-border bg-surface">
        <MarketingContainer>
          <SectionIntro title="What a demo is for">
            <p>
              We use it to show how evidence, action, problem solving,
              improvement and learning stay connected in Lean Excellence Hub.
            </p>
          </SectionIntro>
          <ul className="marketing-demo-outcomes mt-8" role="list">
            <li>
              <h2 className="marketing-subheading">The connected loop</h2>
              <p>
                How a Gemba finding becomes an owned action, a problem-solving
                case, a project and a benefit awaiting validation.
              </p>
            </li>
            <li>
              <h2 className="marketing-subheading">Maturity as the engine</h2>
              <p>
                How organisations start from the LEH Operational Excellence
                Standard — 5 pillars, 30 criteria, 60 scored questions — or
                author their own framework.
              </p>
            </li>
            <li>
              <h2 className="marketing-subheading">LeanAI with governance</h2>
              <p>
                How assistance stays inside the current organisation, site and
                workflow, while a person still reviews and publishes.
              </p>
            </li>
            <li>
              <h2 className="marketing-subheading">Scope and roles</h2>
              <p>
                How Operational Excellence leadership, site leadership, area
                leaders and frontline teams can work in the same system without
                seeing the same things.
              </p>
            </li>
          </ul>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer className="max-w-3xl">
          <h2 className="marketing-heading">Next step</h2>
          <p className="marketing-copy mt-4">
            Demo requests are not yet connected to a scheduling or inbox
            destination. We have not invented an email address or calendar
            availability. Qualification, scheduling and confirmation still need
            a real contact path before requests can be collected here.
          </p>
          <p className="marketing-copy mt-4">
            If you already have access, sign in. To see the public product
            story, explore the platform on the homepage.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/#platform">Explore the platform</Link>
            </Button>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingShell>
  );
}
