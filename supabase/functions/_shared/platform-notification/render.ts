import { escapeHtml } from "../notification-delivery/html-escape.ts";

export type PlatformNotificationEvent = {
  eventId: string;
  idempotencyKey: string;
  eventKind: string;
  organisationId: string | null;
  payload: Record<string, unknown>;
  recipientEmail: string;
  attemptCount: number;
  leaseToken: string;
};

const HIDDEN_PAYLOAD_KEY = /secret|password|token|api[_-]?key/i;

function textValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

export function stripeModePhrase(payload: Record<string, unknown>) {
  if (payload.stripe_livemode === true) {
    return "Stripe live";
  }
  if (payload.stripe_livemode === false) {
    return "Stripe test";
  }
  return "Stripe mode not observed";
}

export function renderPlatformNotification(input: {
  appOrigin: string | null;
  event: PlatformNotificationEvent;
  from: string;
}) {
  const payload = input.event.payload;
  const mode = stripeModePhrase(payload);
  const organisation =
    textValue(payload, "organisation_name") ?? "an organisation";
  const lines = describe(input.event.eventKind, payload, organisation, mode);
  const visibleEntries = Object.entries(payload).filter(
    ([key, value]) =>
      !HIDDEN_PAYLOAD_KEY.test(key) &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null),
  );
  const detail = visibleEntries
    .map(([key, value]) => `${key}: ${value === null ? "—" : String(value)}`)
    .join("\n");
  const consoleLine = input.appOrigin
    ? `Review it in the platform owner console: ${input.appOrigin}/org_admin`
    : "Review it in the platform owner console.";
  const text = [...lines, "", detail, "", consoleLine].join("\n");
  const html = [
    ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
    "<ul>",
    ...visibleEntries.map(
      ([key, value]) =>
        `<li><strong>${escapeHtml(key)}</strong>: ${escapeHtml(
          value === null ? "—" : String(value),
        )}</li>`,
    ),
    "</ul>",
    `<p>${escapeHtml(consoleLine)}</p>`,
  ].join("");

  return {
    from: input.from,
    html,
    subject: subjectFor(input.event.eventKind, mode, organisation),
    text,
    to: input.event.recipientEmail,
  };
}

function subjectFor(kind: string, mode: string, organisation: string) {
  switch (kind) {
    case "founder.email_confirmed":
      return "LEH: founder confirmed their account";
    case "organisation.founded":
      return `LEH: organisation founded — ${organisation}`;
    case "subscription.entitlement_activated":
      return `LEH: ${mode} subscription activated — ${organisation}`;
    case "billing.payment_failed":
      return `LEH: ${mode} payment failed — ${organisation}`;
    case "subscription.cancelled":
      return `LEH: ${mode} subscription cancelled — ${organisation}`;
    default:
      return `LEH: platform event — ${kind}`;
  }
}

function describe(
  kind: string,
  payload: Record<string, unknown>,
  organisation: string,
  mode: string,
) {
  switch (kind) {
    case "founder.email_confirmed":
      return [
        "A founding account confirmed its email address.",
        "This is not an organisation and it is not a paid customer.",
      ];
    case "organisation.founded":
      return [
        `${organisation} was founded and is provisioning.`,
        "Provisioning is not a verified customer. No Stripe payment has been confirmed.",
      ];
    case "subscription.entitlement_activated":
      return [
        `${organisation} now has verified operational entitlement from a Stripe subscription event.`,
        `Observed mode: ${mode}.`,
        "A Checkout browser redirect is not payment confirmation. This alert is sent only after the verified subscription event is stored.",
      ];
    case "billing.payment_failed":
      return [
        `${organisation} has a failed Stripe payment.`,
        `Observed mode: ${mode}.`,
        "This follows a verified Stripe billing event, not a Checkout redirect.",
      ];
    case "subscription.cancelled":
      return [
        `${organisation} has a Stripe cancellation update (${textValue(payload, "cancellation") ?? "updated"}).`,
        `Observed mode: ${mode}.`,
        "This follows a verified Stripe billing event, not a Checkout redirect.",
      ];
    default:
      return [`A platform event was recorded: ${kind}.`];
  }
}
