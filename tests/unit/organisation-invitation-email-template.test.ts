import { describe, expect, it } from "vitest";

import { renderOrganisationInvitationEmail } from "../../supabase/functions/_shared/organisation-invitation-delivery/templates.ts";

describe("organisation invitation email template", () => {
  it("renders branded HTML and text with activate URL", () => {
    const rendered = renderOrganisationInvitationEmail({
      organisationName: "CookieWorks",
      recipientEmail: "colleague@example.test",
      intendedDisplayName: "Alex",
      activateUrl:
        "https://app.example.test/invitations/token/activate#inbox_proof=abc",
      appOrigin: "https://leanexcellencehub.com",
    });

    expect(rendered.subject).toContain("CookieWorks");
    expect(rendered.html).toContain("Create account");
    expect(rendered.html).toContain(
      'src="https://leanexcellencehub.com/email/leh-logo.png"',
    );
    expect(rendered.html).toContain('alt="Lean Excellence Hub"');
    expect(rendered.html).not.toContain("LEAN EXCELLENCE HUB");
    expect(rendered.html).toContain("#inbox_proof=abc");
    expect(rendered.text).toContain("colleague@example.test");
  });

  it("keeps a text wordmark without a remote logo when APP_ORIGIN is absent", () => {
    const rendered = renderOrganisationInvitationEmail({
      organisationName: "CookieWorks",
      recipientEmail: "colleague@example.test",
      activateUrl:
        "https://app.example.test/invitations/token/activate#inbox_proof=abc",
    });

    expect(rendered.html).not.toContain("<img");
    expect(rendered.html).toContain("LEAN EXCELLENCE HUB");
  });
});
