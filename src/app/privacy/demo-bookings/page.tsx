import type { Metadata } from "next";
import Link from "next/link";

import { MarketingContainer, MarketingKicker } from "@/components/marketing/primitives";
import { MarketingShell } from "@/components/marketing/shell";

/**
 * DRAFT ONLY. Owner/legal sign-off is required before publishing this notice:
 * - Verify the legal spelling of the sole-trader controller's name.
 * - Approve lawful basis and an operationally enforced retention policy.
 * - Verify Cal.com event questions, video/calendar integrations, transfer and
 *   marketing practices, then remove the draft warning and noindex.
 *
 * Do not merge this page with unapproved placeholders.
 */
export const metadata: Metadata = {
  title: "Demo booking privacy notice (draft) — Lean Excellence Hub",
  description: "Draft privacy information for prospective customers booking a Lean Excellence Hub demonstration.",
  robots: { index: false, follow: false },
};

export default function DemoBookingPrivacyPage() {
  return (
    <MarketingShell>
      <MarketingContainer>
        <article className="mx-auto max-w-3xl py-12 sm:py-16" aria-labelledby="demo-privacy-title">
          <MarketingKicker>Privacy and transparency</MarketingKicker>
          <h1 id="demo-privacy-title" className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Demo booking privacy notice
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            How personal information is used when someone books and attends a
            Lean Excellence Hub product demonstration.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Effective date: [OWNER TO APPROVE PUBLICATION DATE]
          </p>
          <div role="alert" className="mt-6 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
            <strong>Draft — not approved for publication.</strong> Before
            activating public bookings, confirm the sole-trader legal name,
            approve a real retention policy and lawful basis, and verify the
            calendar/video integrations and international transfers.
          </div>

          <div className="mt-8 space-y-8 text-sm leading-7 text-foreground sm:text-base">
            <section aria-labelledby="demo-privacy-controller">
              <h2 id="demo-privacy-controller" className="text-xl font-semibold">Who is responsible?</h2>
              <p className="mt-2">
                Before incorporation, Lean Excellence Hub is operated as a
                sole-trader business under the trading name
                {" "}<strong>Lean Excellence Hub</strong>. The responsible data
                controller is <strong>Przemyslaw Rząsa (sole trader, trading as
                Lean Excellence Hub)</strong>. This spelling must be verified
                by the operator before this draft is published.
                {" "}For demo-booking privacy enquiries or rights requests,
                email{" "}
                <a className="underline underline-offset-4" href="mailto:admin.lean.excellence.hub@gmail.com">
                  admin.lean.excellence.hub@gmail.com
                </a>.
                The proposed Lean Excellence Hub company has
                <strong> not yet been incorporated</strong> and is not
                currently the controller. If a limited company later takes
                over the service, we will update this notice to identify that
                company and explain any relevant changes to processing
                responsibilities. Cal.com provides the booking form on behalf
                of the current event organiser.
              </p>
            </section>

            <section aria-labelledby="demo-privacy-data">
              <h2 id="demo-privacy-data" className="text-xl font-semibold">What information is involved?</h2>
              <p className="mt-2">
                A booking normally includes your name, email address, selected
                meeting date and time, and any answers to the questions actually
                configured for the event. Depending on the form, optional answers
                may include your organisation, role, number of sites and the
                improvement topics you want to discuss. The scheduling provider
                may also process technical information such as your IP address,
                browser and time zone in order to operate its service.
              </p>
              <p className="mt-2">
                A name, contact email and available meeting slot are normally
                needed to arrange a demonstration. Optional booking questions
                need not be answered unless the event explicitly marks them
                required. Without the basic meeting details, we cannot process
                a request for a live booking.
              </p>
              <p className="mt-2">Please do not submit financial results, personal health information, confidential customer records or other sensitive materials in the booking form.</p>
            </section>

            <section aria-labelledby="demo-privacy-purposes">
              <h2 id="demo-privacy-purposes" className="text-xl font-semibold">Why we use the information</h2>
              <p className="mt-2">
                We use booking details to arrange the demonstration, prevent
                scheduling conflicts, send meeting logistics through our booking
                provider, prepare a discussion relevant to your enquiry, host the
                meeting, and follow up about the matters you requested.
              </p>
              <p className="mt-2">
                <strong>Proposed lawful basis (requires owner confirmation):</strong>
                {" "}legitimate interests in answering voluntarily requested
                business enquiries and arranging relevant product discussions,
                after considering your rights and expectations. Where steps are
                taken at your request before entering a contract, that basis may
                instead apply to the relevant processing.
              </p>
              <p className="mt-2">
                Booking a demonstration does not automatically subscribe you
                to a promotional mailing list. Any separate direct marketing
                must have its own valid legal basis and comply with applicable
                UK electronic marketing rules.
              </p>
            </section>

            <section aria-labelledby="demo-privacy-sharing">
              <h2 id="demo-privacy-sharing" className="text-xl font-semibold">Providers and international transfers</h2>
              <p className="mt-2">
                Cal.com handles scheduling, confirmations, rescheduling and
                cancellations on our behalf. Meeting details may be shared
                with the calendar and video-conferencing services actually
                connected to the organiser&apos;s Cal.com event (for example,
                Google Calendar and Google Meet if configured). Such providers
                may process information outside the United Kingdom.
              </p>
              <p className="mt-2">
                We will verify applicable international transfer safeguards
                before activation. Cal.com publishes a
                {" "}<a className="underline underline-offset-4" href="https://cal.com/dpa">data processing agreement</a>
                {" "}and a
                {" "}<a className="underline underline-offset-4" href="https://cal.com/privacy">privacy notice</a>
                {" "}with additional information about its services.
                Those documents do not replace this organiser notice.
              </p>
            </section>

            <section aria-labelledby="demo-privacy-retention">
              <h2 id="demo-privacy-retention" className="text-xl font-semibold">How long information is kept</h2>
              <p className="mt-2">
                <strong>[OWNER TO CONFIRM A REAL RETENTION PERIOD OR CLEAR CRITERIA]</strong>.
                Booking information is kept in Cal.com and in the organiser&apos;s
                connected calendar; this release of Lean Excellence Hub does
                not create a separate database record for demo bookings.
                Any ordinary follow-up correspondence may be held in the
                organiser&apos;s email or business records subject to the approved
                retention policy.
              </p>
            </section>

            <section aria-labelledby="demo-privacy-rights">
              <h2 id="demo-privacy-rights" className="text-xl font-semibold">Your rights and choices</h2>
              <p className="mt-2">
                Depending on the circumstances and lawful basis, you may ask
                for access, correction, deletion or restriction of your personal
                information, object to relevant processing, or request portability
                where applicable. You may cancel or reschedule using the links
                sent by Cal.com. To exercise your rights in relation to
                demo bookings, email{" "}
                <a href="mailto:admin.lean.excellence.hub@gmail.com" className="underline underline-offset-4">
                  admin.lean.excellence.hub@gmail.com
                </a>.
                If we rely on legitimate interests, you also have the
                right to object to processing based on that lawful basis.
              </p>
              <p className="mt-2">
                You may complain to the UK Information Commissioner&apos;s Office:
                {" "}<a className="underline underline-offset-4" href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a>.
                We do not use a solely automated decision to determine whether
                you should buy or use Lean Excellence Hub based on your demo booking.
              </p>
            </section>

            <section aria-labelledby="demo-privacy-scope">
              <h2 id="demo-privacy-scope" className="text-xl font-semibold">Scope of this notice</h2>
              <p className="mt-2">
                This notice is limited to requests for and participation in
                Lean Excellence Hub product demonstrations. It is not a complete
                privacy policy for LEH customer accounts, tenant data, product
                analytics or other processing within the platform.
              </p>
            </section>
          </div>

          <p className="mt-10 border-t border-border pt-5 text-sm text-muted-foreground">
            <Link href="/demo" className="font-medium text-primary underline-offset-4 hover:underline">
              Return to demo booking
            </Link>
          </p>
        </article>
      </MarketingContainer>
    </MarketingShell>
  );
}
