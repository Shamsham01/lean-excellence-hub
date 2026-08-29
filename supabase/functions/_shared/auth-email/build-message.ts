import { buildAuthConfirmUrl, resolveTokenHashForAction } from "./confirm-url";
import { validateApplicationOrigin } from "./origin";
import {
  renderGenericConfirmEmail,
  renderRecoveryEmail,
  renderSignupConfirmationEmail,
} from "./templates";
import type { AuthEmailBuildResult, SendEmailHookPayload } from "./types";

export function buildAuthEmailDelivery(
  payload: SendEmailHookPayload,
  origin: string,
): AuthEmailBuildResult {
  try {
    validateApplicationOrigin(origin);
  } catch {
    return { ok: false, reason: "invalid_origin" };
  }

  const { email_data: emailData } = payload;
  const tokenHash = resolveTokenHashForAction(
    emailData.email_action_type,
    emailData.token_hash,
    emailData.token_hash_new,
  );

  if (!tokenHash) {
    return { ok: false, reason: "missing_token_hash" };
  }

  const confirmUrl = buildAuthConfirmUrl(
    origin,
    tokenHash,
    emailData.email_action_type,
  );

  if (!confirmUrl) {
    return { ok: false, reason: "unsupported_action" };
  }

  switch (emailData.email_action_type) {
    case "signup": {
      const delivery = renderSignupConfirmationEmail(confirmUrl);
      return {
        ok: true,
        delivery: {
          ...delivery,
          confirmUrl,
        },
      };
    }
    case "recovery": {
      const delivery = renderRecoveryEmail(confirmUrl);
      return {
        ok: true,
        delivery: {
          ...delivery,
          confirmUrl,
        },
      };
    }
    case "invite": {
      const delivery = renderGenericConfirmEmail(
        "You have been invited to Lean Excellence Hub",
        "Accept your invitation",
        "You have been invited to create a Lean Excellence Hub account.",
        "Accept invitation",
        confirmUrl,
      );
      return {
        ok: true,
        delivery: {
          ...delivery,
          confirmUrl,
        },
      };
    }
    case "magiclink": {
      const delivery = renderGenericConfirmEmail(
        "Sign in to Lean Excellence Hub",
        "Sign in to your account",
        "Use the secure link below to sign in to Lean Excellence Hub.",
        "Sign in",
        confirmUrl,
      );
      return {
        ok: true,
        delivery: {
          ...delivery,
          confirmUrl,
        },
      };
    }
    case "email_change":
    case "email_change_new": {
      const delivery = renderGenericConfirmEmail(
        "Confirm your new email address",
        "Confirm your new email address",
        "Confirm this email address change for your Lean Excellence Hub account.",
        "Confirm email change",
        confirmUrl,
      );
      return {
        ok: true,
        delivery: {
          ...delivery,
          confirmUrl,
        },
      };
    }
    default:
      return { ok: false, reason: "unsupported_action" };
  }
}

export function formatAuthEmailFrom(
  fromName: string,
  fromEmail: string,
): string {
  const trimmedName = fromName.trim();
  const trimmedEmail = fromEmail.trim();

  if (!trimmedEmail) {
    throw new Error("AUTH_EMAIL_FROM is required.");
  }

  if (!trimmedName) {
    return trimmedEmail;
  }

  return `${trimmedName} <${trimmedEmail}>`;
}
