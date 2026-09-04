import { createHash } from "node:crypto";

export function invitationTokenFromSeed(seed: string) {
  return createHash("sha256").update(seed).digest("base64url");
}

export function invitationTokenDigest(token: string) {
  return `\\x${createHash("sha256").update(token).digest("hex")}`;
}
