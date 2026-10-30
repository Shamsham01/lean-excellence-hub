/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import { parseInvitationContinuation } from "@/modules/identity/invitation-continuation";

const bindingId = "11111111-1111-4111-8111-111111111111";

describe("invitation continuation payload", () => {
  it("redirects only for a validated continue or rebind binding", () => {
    expect(
      parseInvitationContinuation({
        outcome: "continue",
        binding_id: bindingId,
      }),
    ).toEqual({
      kind: "redirect",
      path: `/invitations/continue/${bindingId}`,
    });
    expect(
      parseInvitationContinuation({
        outcome: "rebind",
        binding_id: bindingId,
      }).kind,
    ).toBe("redirect");
  });

  it("does not treat metadata-shaped junk as access", () => {
    expect(parseInvitationContinuation({ outcome: "continue" })).toEqual({
      kind: "none",
    });
    expect(
      parseInvitationContinuation({
        outcome: "continue",
        binding_id: "not-a-binding",
      }),
    ).toEqual({ kind: "none" });
    expect(
      parseInvitationContinuation({
        outcome: "unavailable",
        detail: "invitation_expired",
      }),
    ).toEqual({ kind: "unavailable", detail: "invitation_expired" });
    expect(
      parseInvitationContinuation({
        outcome: "unavailable",
        detail: "invitation_revoked",
      }),
    ).toEqual({ kind: "unavailable", detail: "invitation_revoked" });
  });
});
