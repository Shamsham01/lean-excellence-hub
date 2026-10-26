# Live demo booking setup

Lean Excellence Hub does not calculate availability and does not store demo bookings. Cal.com is the system of record. `/demo` embeds the organiser's booking link when `NEXT_PUBLIC_DEMO_BOOKING_URL` is a valid HTTPS address on `cal.com` or `cal.eu` (including subdomains such as `app.cal.com`).

No Cal.com API secret is required for this embed. Do not put a Cal.com API key, OAuth token or webhook secret in a `NEXT_PUBLIC_` variable.

Changing the variable requires a new production build. Next.js inlines `NEXT_PUBLIC_` values at build time. Restart `next dev` after changing it locally.

Until the variable is set, `/demo` says that live booking is not connected. It does not show sample times.

## Prerequisite: an approved privacy notice

Do not set `NEXT_PUBLIC_DEMO_BOOKING_URL` on a public site until all of the following are true:

1. Lean Excellence Hub has an approved privacy notice for demonstration bookings. It needs to say that the booking form is Cal.com's, that Cal.com sends the confirmation and meeting details, and that this release does not keep a separate booking record.
2. That notice is published at a stable address and linked from `/demo`.
3. The questions on the Cal.com event have been checked against that notice.

Do not draft that notice in this repository, and do not describe it as published before it is. `/demo` links the [Cal.com privacy notice](https://cal.com/privacy). That link does not stand in for the Lean Excellence Hub notice.

Until the notice is approved and linked, leave `NEXT_PUBLIC_DEMO_BOOKING_URL` empty.

## 1. Create the Cal.com event

1. Create or open the organiser account at [cal.com](https://cal.com). Use the account that should own the demonstration calendar. Lean Excellence Hub cannot create this account.
2. Open **Settings → My account → General** and set the organiser timezone to **Europe/London**. Leave the booking page timezone unlocked so a visitor sees times in their own timezone, including daylight-saving changes. Cal.com applies those changes. The LEH page does not.
3. Open **Settings → My account → Calendars**. Connect Google Calendar or Outlook. Turn on **Check for conflicts** for the calendars that should block time. Under **Add events to**, choose the calendar that should receive the booking. Steps are in [Calendars and conferencing](https://cal.com/help/my-account/calendars-and-conferencing).
4. Open **Settings → My account → Conferencing**. Add **Google Meet** and set it as the default. The meeting link is created by Cal.com and sent in the booking email and calendar invitation.
5. Create a booking link:
   - Name: **Lean Excellence Hub — Product Demonstration**
   - Duration: **45 minutes**
   - Location: the Google Meet conferencing app, not a phone number and not a physical address
   - Availability: the organiser's own schedule. Do not copy hours into the LEH codebase.
6. Open the booking link's **Limits & buffers** tab. Set the buffer after the meeting to **15 minutes**. Set the minimum booking notice to **24 hours**. Limit how far ahead a visitor can book to **30 days**. Limit concurrent and daily bookings to the number of demonstrations the organiser can actually host. See [Event buffers](https://cal.com/help/event-types/event-buffer) and [Limit future bookings](https://cal.com/help/event-types/limit-future-bookings).
7. Choose the booking questions in Cal.com. These are recommendations for the event, not a description of the public page, and only if the approved privacy notice covers them:
   - Name
   - Business email
   - Organisation
   - Job role
   - Approximate number of operational sites
   - Primary Continuous Improvement or Operational Excellence challenge

   Keep only name and business email mandatory unless the organiser decides otherwise. Do not ask for financial results, savings figures or confidential documents. Do not require payment. `/demo` must not list specific questions until they are the questions on the published event. See [Booking questions](https://cal.com/help/event-types/booking-questions).
8. Copy the public booking link. It looks like `https://cal.com/<organiser>/<event-slug>`. That is the only value LEH needs.

## 2. Publish the link to LEH

1. Confirm the privacy-notice prerequisite above is met. Then set `NEXT_PUBLIC_DEMO_BOOKING_URL` in the deployment environment to that exact HTTPS link. Do not set it while the prerequisite is still open.
2. Rebuild and redeploy the site. Do not commit the real link if the repository is public and the organiser wants to rotate it; the variable is public by nature once the page embeds it.
3. Open `/demo`. The page should show the Cal.com calendar and a link labelled **Open the booking page**. The direct link is the fallback if the embed does not load.
4. An empty variable, or a URL that is not an approved Cal.com HTTPS booking link, leaves the calendar hidden. The page explains that a meeting cannot be reserved. It does not echo a rejected address.

Approved hosts are `cal.com`, `cal.eu` and their subdomains. A custom booking domain needs a code change to the allowlist in `src/lib/marketing/demo-booking.ts`. That keeps a bad environment value from framing an arbitrary site.

## 3. Confirm a booking before calling the page live

Do this once, with the organiser's approval, before sending customers to the page:

1. Book a 45-minute slot as a test attendee.
2. Confirm the Cal.com email, the calendar invitation on the connected calendar, and a Google Meet link.
3. Reschedule from the link in that email, then cancel it.
4. Confirm Lean Excellence Hub did not gain a booking row of its own. There is no LEH success screen. The confirmation inside Cal.com is the confirmation.

An embed event in the browser is not treated as a booking. `bookingSuccessful` is deliberately not handled.

## 4. Content Security Policy

`next.config.ts` does not send `Content-Security-Policy`. It sends `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.

`X-Frame-Options: DENY` stops other sites from framing Lean Excellence Hub. It does not stop `/demo` from embedding Cal.com. No CSP allowlist change is required for the current headers.

The embed loads `{origin}/embed/embed.js` and frames the booking page. If a Content-Security-Policy is added later, allow the booking origin on `script-src`, `frame-src`, `connect-src` and `img-src`. A policy that omits the existing Next.js, Supabase and Stripe origins would break the rest of the product, so do not add a partial policy only for `/demo`.

Playwright sets `DEMO_BOOKING_E2E=1` on its own server so a test can pass `x-leh-e2e-demo-booking-url`. The header is still checked against the allowlist. Do not set `DEMO_BOOKING_E2E` on a deployed environment. Without that flag, `/demo` ignores the header.

## 5. Later phase, not this release

Server-side webhooks, a booking table, or a CRM copy of attendee answers are a separate change. They need a Cal.com webhook secret stored only on the server, signature checks, and a decision about what LEH is allowed to retain. Do not add them in order to make the public page "confirm" a booking. Cal.com already sends the email and the calendar invitation.
