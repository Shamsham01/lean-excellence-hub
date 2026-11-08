import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createInvitationInboxProof,
  invitationInboxProofDigest,
} from "@/modules/identity/invitation-inbox-proof";

describe("invitation inbox proof", () => {
  it("creates URL-safe proofs and stable digests", () => {
    const proof = createInvitationInboxProof();
    expect(proof.length).toBeGreaterThan(20);
    expect(invitationInboxProofDigest(proof)).toBe(
      `\\x${createHash("sha256").update(proof).digest("hex")}`,
    );
  });
});
