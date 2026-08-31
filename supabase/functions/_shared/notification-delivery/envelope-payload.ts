import type { OperationalEmailMessage } from "./provider/types.ts";

export async function computeProviderPayloadHash(
  message: OperationalEmailMessage,
): Promise<string> {
  const canonical = JSON.stringify({
    from: message.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
