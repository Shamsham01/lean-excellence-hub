import { describe, expect, it } from "vitest";

import {
  invitationContinuePath,
  isInvitationSignupBindingId,
  safeInvitationContinuation,
} from "@/modules/identity/invitation-constants";

describe("invitation signup binding helpers", () => {
  it("accepts canonical binding ids", () => {
    const bindingId = "8b34dcdd-9df1-4c10-850a-b3277c653040";
    expect(isInvitationSignupBindingId(bindingId)).toBe(true);
    expect(invitationContinuePath(bindingId)).toBe(
      `/invitations/continue/${bindingId}`,
    );
    expect(
      safeInvitationContinuation(`/invitations/continue/${bindingId}`),
    ).toBe(`/invitations/continue/${bindingId}`);
  });

  it("rejects raw invitation tokens as binding ids", () => {
    expect(isInvitationSignupBindingId("not-a-binding-id")).toBe(false);
    expect(
      safeInvitationContinuation("/invitations/continue/not-a-binding-id"),
    ).toBeNull();
  });
});
