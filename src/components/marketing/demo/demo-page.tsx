import Link from "next/link";

import { DemoBookingCalendar } from "@/components/marketing/demo/booking-calendar";
import {
  MarketingContainer,
  MarketingKicker,
} from "@/components/marketing/primitives";
import { MarketingShell } from "@/components/marketing/shell";
import {
  type DemoBookingState,
  readDemoBooking,
} from "@/lib/marketing/demo-booking";

import "./demo.css";

const FACTS = [
  ["Duration", "45-minute personalised walkthrough"],
  ["Format", "Live online meeting"],
  ["Journey", "Connected improvement workflow"],
  ["Standards", "Configurable Lean frameworks and standards"],
  ["Assistance", "LeanAI contextual assistance"],
  ["Organisation", "Multi-site operations and governance"],
  ["Discussion", "Questions and discussion"],
  ["Commitment", "No obligation"],
] as const;

export function MarketingDemoPage({
  booking = readDemoBooking(),
}: {
  booking?: DemoBookingState;
}) {
  return (
    <MarketingShell>
      <article className="demo-page">
        <MarketingContainer>
          <div className="demo-layout">
            <div className="demo-copy">
              <MarketingKicker>Book a live demo</MarketingKicker>
              <h1>See operational excellence connected.</h1>
              <p className="demo-lede">
                Discover how Lean Excellence Hub connects everyday improvement,
                from the first observation to measurable business impact.
              </p>
              <p className="demo-proposition">
                Your framework. Your standards. Your way of working. One
                connected platform.
              </p>

              <dl className="demo-facts">
                {FACTS.map(([term, detail]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>

              <h2>What we will cover</h2>
              <ol className="demo-agenda">
                <li>
                  <p>Your current improvement system</p>
                  <p>
                    Where Gemba, 5S, actions, projects and performance
                    information sit today, and where the gaps cost time.
                  </p>
                </li>
                <li>
                  <p>One connected finding</p>
                  <p>
                    A fictional manufacturing example, from the observation
                    through action, problem solving, the improvement project, a
                    benefit awaiting validation, and what the organisation
                    learns.
                  </p>
                </li>
                <li>
                  <p>Standards, assistance and governance</p>
                  <p>
                    Frameworks you configure, LeanAI in the context of the work,
                    and the rule that a person still reviews and decides.
                  </p>
                </li>
                <li>
                  <p>Fit and next steps</p>
                  <p>
                    First site, further sites, and the questions you want
                    answered. Nothing is purchased on the call.
                  </p>
                </li>
              </ol>

              <h2>Your details</h2>
              <p>
                If scheduling is connected, Cal.com asks for your name, business
                email, organisation, role, approximate number of operational
                sites, and the improvement challenge you want to discuss. It
                does not ask for financial results or confidential documents.
                Cal.com collects those answers and sends the confirmation,
                calendar invitation and meeting link. Lean Excellence Hub does
                not keep a separate booking record in this release, and this
                page does not publish its own confirmation.
              </p>
              <p>
                Lean Excellence Hub has not published a privacy policy for this
                form.{" "}
                <a href="https://cal.com/privacy">Cal.com privacy notice</a>.
              </p>
              <p className="demo-secondary">
                <Link href="/login">Sign in</Link>
                <Link href="/#platform">Explore the platform</Link>
              </p>
            </div>

            <DemoBookingPanel booking={booking} />
          </div>
        </MarketingContainer>
      </article>
    </MarketingShell>
  );
}

function DemoBookingPanel({ booking }: { booking: DemoBookingState }) {
  if (booking.status === "ready") {
    return <DemoBookingCalendar booking={booking} />;
  }

  const invalid = booking.status === "invalid";

  return (
    <section
      className="demo-calendar demo-calendar-empty"
      aria-labelledby="demo-booking-unavailable"
      data-booking-state={booking.status}
    >
      <h2 id="demo-booking-unavailable">
        {invalid
          ? "Scheduling link is not usable"
          : "Live booking is not connected"}
      </h2>
      <p>
        {invalid
          ? "The scheduling address for this deployment is not an approved Cal.com booking link. No calendar is shown, and a meeting cannot be reserved here."
          : "Available times are supplied by Cal.com once a booking link is published. This page does not show sample times, and a meeting cannot be reserved here yet."}
      </p>
      <p>
        Confirmation, a meeting link, cancellation and rescheduling are handled
        by Cal.com after a real booking exists. Nothing on this page is a
        confirmed meeting.
      </p>
    </section>
  );
}
