import { createHash, randomBytes } from "node:crypto";

export function createInvitationInboxProof() {
  return randomBytes(32).toString("base64url");
}

export function invitationInboxProofDigest(inboxProof: string) {
  return `\\x${createHash("sha256").update(inboxProof).digest("hex")}`;
}
