import { describe, expect, it } from "vitest";

import {
  isDeliverableEmailAddress,
  mapRecipientFailureCode,
} from "../../supabase/functions/_shared/notification-delivery/recipient.ts";

describe("recipient resolution", () => {
  it("accepts a valid invited-user contact", () => {
    expect(isDeliverableEmailAddress("employee@example.test")).toBe(true);
  });

  it("accepts a valid explicit workforce notification email", () => {
    expect(isDeliverableEmailAddress("ops-contact@customer.example")).toBe(
      true,
    );
  });

  it("rejects synthetic workforce auth email", () => {
    expect(
      isDeliverableEmailAddress(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@workforce.invalid",
      ),
    ).toBe(false);
  });

  it("rejects .invalid domain addresses", () => {
    expect(isDeliverableEmailAddress("placeholder@company.invalid")).toBe(
      false,
    );
  });

  it("rejects malformed recipient contact", () => {
    expect(isDeliverableEmailAddress("not-an-email")).toBe(false);
  });

  it("maps inactive membership to terminal failure code", () => {
    expect(mapRecipientFailureCode("inactive_membership")).toBe(
      "inactive_membership",
    );
  });

  it("maps missing contact to terminal failure code", () => {
    expect(mapRecipientFailureCode("no_contact")).toBe(
      "missing_recipient_contact",
    );
  });

  it("maps synthetic auth email to terminal failure code", () => {
    expect(mapRecipientFailureCode("synthetic_auth_email")).toBe(
      "synthetic_auth_email",
    );
  });

  it("maps not authorized to terminal failure code", () => {
    expect(mapRecipientFailureCode("not_authorized")).toBe(
      "recipient_no_longer_authorized",
    );
  });
});
