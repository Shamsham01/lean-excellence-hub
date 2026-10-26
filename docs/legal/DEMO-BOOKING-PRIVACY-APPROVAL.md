# LEGAL-PRIVACY-001 — Demo booking privacy approval checklist

**Status: DRAFT / NOT APPROVED FOR PUBLICATION**

This draft exists to enable review. The **controller name and retention interval are now confirmed** but the remaining provider, basis, retention-execution and publication checks below still apply. It is not legal advice and must not be represented as an approved customer notice before those checks are completed. The prepared route is `/privacy/demo-bookings`. Its current source displays unverified placeholders and a DRAFT warning, and its metadata prevents search indexing.

## Owner approval required

- [ ] **Owner decision confirmed (2026-10-26):** the intended legal operator is a new `Lean Excellence Hub` company to be registered before production/first paying customer. **It is not incorporated yet.** Do not identify the proposed company as an existing controller or invent a registration number.
- [x] **Owner decision confirmed (2026-10-26): Option B.** Accept demo enquiries ahead of incorporation with the individual sole trader acting as the interim data controller. The future limited company must not be described as if it already exists.
- [x] **Legal name confirmed by owner (2026-10-26):** `Przemyslaw Rzasa` (without Polish accents), **sole trader trading as Lean Excellence Hub**. Use exactly this spelling in the published controller notice until incorporation.
- [x] **Privacy contact specified by owner:** `admin.lean.excellence.hub@gmail.com`. Confirm the inbox is actively monitored for rights requests (and secured with two-factor authentication).
- [ ] After incorporation, confirm and insert the registered legal company name, registration number (if used in notice), business contact and applicable registered address/details; amend notice and any contracts when processing responsibility changes.
- [ ] Check if any further controller contact/location information is needed for the published notice; use a genuine business contact/address as appropriate, without exposing the individual's home address unnecessarily.
- [ ] Agree the lawful basis for handling requested business demo bookings; confirm any legitimate interests assessment or pre-contract steps relied on. The draft suggests alternatives, not a final conclusion.
- [x] **Retention period confirmed by owner (2026-10-26): 12 months** after the last relevant booking/demo enquiry interaction, with exceptions where legally required or reasonably necessary for legal claims.
- [ ] **Operationalise the 12-month period**: at least monthly review Cal.com booking history, organiser calendar and related Gmail conversation threads; delete or anonymise expired records wherever supported. If Cal.com lacks automatic individual-booking retention controls, document and perform manual deletion/review. Provider backups may follow their own retention cycle. Do not claim automatic data purging exists without testing it.
- [ ] Check whether the sole-trader use of booking/contact data triggers an ICO data-protection fee obligation or an exemption (https://ico.org.uk/for-organisations/data-protection-fee/). If a fee applies, arrange registration and payment before routine business use.
- [ ] Confirm which calendar/video providers are actually linked to the event and how data transfers outside the UK are safeguarded. Review the effective **current** Cal.com DPA, transfer commitments and connected provider documentation on the release date.
- [ ] Review the live Cal.com booking form questions and their optional/required settings. Remove questions not described in the final notice; do not request confidential or special category information.
- [ ] Confirm that booking attendees are **not** automatically added to a promotional mailing list. If separate email marketing is intended, design appropriate PECR/UK GDPR handling and notices independently.
- [ ] Agree who can access bookings and who acts on subject-rights requests.
- [x] Controller name spelling and retention-period placeholders removed from `src/app/privacy/demo-bookings/page.tsx`.
- [ ] Confirm all remaining disclosures and processing choices, remove the draft warning, and set the metadata to an accurate **publication** title, effective date and indexing setting.
- [ ] Ensure `/demo` links to the **approved LEH** notice as well as Cal.com's separate notice, and footer shows a working link.
- [ ] Publish the approved page on `https://leanexcellencehub.com/privacy/demo-bookings` before enabling the live embedded calendar.
- [ ] Add `https://leanexcellencehub.com/privacy/demo-bookings` to the Cal.com **demo event's description or supported booking-question explanation**, so attendees arriving directly via `https://cal.com/lean-excellence-hub/demo` also see the LEH notice before submitting. Do not claim this event configuration has already been changed.
- [ ] After the page is live, set `NEXT_PUBLIC_DEMO_BOOKING_URL=https://cal.com/lean-excellence-hub/demo` in Netlify, rebuild, test book/reschedule/cancel, and verify confirmation, organiser calendar and meeting link.

## Implementation boundary

The notice concerns **demo scheduling only**, not every LEH product processing activity. A broader platform/customer privacy notice, terms and retention/security documentation are separate tasks. Do not widen the scope by claiming the demo notice covers platform tenants, training and employee data.

Sources consulted (check for changes before final approval):
- ICO: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/
- ICO: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/
- Cal.com: https://cal.com/privacy and https://cal.com/dpa

**Provider effective-date caution:** The Cal.com policy/DPA displayed during drafting referred to 1 November 2026, which is after the drafting date (26 October 2026). Check the binding terms effective when activating the event.

## Transition from sole trader to incorporated company

Once the new Lean Excellence Hub company is registered and actually assumes responsibility for the demo-booking service:

1. Verify its registered legal name and company number, plus valid contact details.
2. Determine whether existing prospect booking records will transfer to the company; document the lawful basis and any required communication before doing so.
3. Update the controller section, effective date and contact links on the published notice before changing operational responsibility.
4. Review Cal.com account ownership, its processing agreement and connected calendar/conferencing service agreements.
5. Keep prior versions of the notice and maintain a record of when each controller was responsible.

A new company is not automatically responsible for booking data gathered beforehand; do not retrospectively rewrite the historic sole-trader controller identity.
