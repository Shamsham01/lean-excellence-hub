# LEGAL-PRIVACY-001 — Demo booking privacy approval checklist

**Status: DRAFT / NOT APPROVED FOR PUBLICATION**

This draft exists to enable review. It is not legal advice and must not be represented as a published or approved customer notice before the checks below are completed. The prepared route is `/privacy/demo-bookings`. Its current source displays unverified placeholders and a DRAFT warning, and its metadata prevents search indexing.

## Owner approval required

- [ ] Confirm the legal name of the individual or registered entity actually operating the LEH demo service. If trading as Lean Excellence Hub, disclose the legally responsible controller, not only the brand.
- [ ] Confirm an actively monitored **public** privacy contact email (and any additional contact details required), suitable for data-rights requests. Never substitute or publish a personal address without consent.
- [ ] Agree the lawful basis for handling requested business demo bookings; confirm any legitimate interests assessment or pre-contract steps relied on. The draft suggests alternatives, not a final conclusion.
- [ ] Confirm a *real* retention period or clear criteria for Cal.com bookings, organiser calendar entries and demo follow-up correspondence. Check Cal.com and the connected calendar's deletion/export and retention controls before promising automatic deletion.
- [ ] Confirm which calendar/video providers are actually linked to the event and how data transfers outside the UK are safeguarded. Review the effective **current** Cal.com DPA, transfer commitments and connected provider documentation on the release date.
- [ ] Review the live Cal.com booking form questions and their optional/required settings. Remove questions not described in the final notice; do not request confidential or special category information.
- [ ] Confirm that booking attendees are **not** automatically added to a promotional mailing list. If separate email marketing is intended, design appropriate PECR/UK GDPR handling and notices independently.
- [ ] Agree who can access bookings and who acts on subject-rights requests.
- [ ] Replace all `[OWNER TO CONFIRM]` and other unfinished statements in `src/app/privacy/demo-bookings/page.tsx`; remove draft warning; set metadata to the accurate publication title, effective date and index setting.
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
