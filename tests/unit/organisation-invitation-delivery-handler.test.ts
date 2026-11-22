import { describe, expect, it } from "vitest";

import { buildOrganisationInvitationActivateUrl } from "../../supabase/functions/_shared/organisation-invitation-delivery/templates.ts";

describe("organisation invitation delivery templates", () => {
  it("builds activate links with fragment inbox proof", () => {
    const url = buildOrganisationInvitationActivateUrl(
      "https://app.example.test",
      "invite-token",
      "proof-value",
    );
    expect(url).toBe(
      "https://app.example.test/invitations/invite-token/activate#inbox_proof=proof-value",
    );
    expect(url).not.toContain("?");
  });
});
