type BrandedEmailContent = {
  eyebrow: string;
  title: string;
  intro: string;
  ctaLabel: string;
  confirmUrl: string;
  footer?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderBrandedAuthEmail(content: BrandedEmailContent): string {
  const eyebrow = escapeHtml(content.eyebrow);
  const title = escapeHtml(content.title);
  const intro = escapeHtml(content.intro);
  const ctaLabel = escapeHtml(content.ctaLabel);
  const confirmUrl = escapeHtml(content.confirmUrl);
  const footer = content.footer ? escapeHtml(content.footer) : "";

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;">
            <tr>
              <td style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;padding-bottom:16px;">
                ${eyebrow}
              </td>
            </tr>
            <tr>
              <td style="font-size:24px;line-height:1.3;font-weight:700;color:#18181b;padding-bottom:16px;">
                ${title}
              </td>
            </tr>
            <tr>
              <td style="font-size:16px;line-height:1.6;color:#3f3f46;padding-bottom:24px;">
                ${intro}
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${confirmUrl}" style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:12px 20px;border-radius:8px;">
                  ${ctaLabel}
                </a>
              </td>
            </tr>
            ${
              footer
                ? `<tr>
              <td style="font-size:14px;line-height:1.6;color:#71717a;">
                ${footer}
              </td>
            </tr>`
                : ""
            }
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderSignupConfirmationEmail(
  confirmUrl: string,
): AuthEmailHtml {
  return {
    subject: "Confirm your Lean Excellence Hub account",
    html: renderBrandedAuthEmail({
      eyebrow: "Lean Excellence Hub",
      title: "Confirm your account",
      intro:
        "You've created an account for Lean Excellence Hub. Confirm your email address to finish setting up your account.",
      ctaLabel: "Confirm account",
      confirmUrl,
      footer:
        "If you're joining through an organisation invitation, you'll return to your invitation after confirmation. If you did not request this, you can ignore this email.",
    }),
    text:
      "Confirm your Lean Excellence Hub account\n\n" +
      "You've created an account for Lean Excellence Hub.\n\n" +
      `Confirm your account: ${confirmUrl}\n\n` +
      "If you're joining through an organisation invitation, you'll return to your invitation after confirmation.\n\n" +
      "If you did not request this, you can ignore this email.",
  };
}

export function renderRecoveryEmail(confirmUrl: string): AuthEmailHtml {
  return {
    subject: "Recover your Lean Excellence Hub account",
    html: renderBrandedAuthEmail({
      eyebrow: "Lean Excellence Hub",
      title: "Recover your account",
      intro:
        "We received a request to recover access to your Lean Excellence Hub account. Continue below to choose a new password.",
      ctaLabel: "Continue account recovery",
      confirmUrl,
      footer:
        "If you did not request account recovery, you can ignore this email.",
    }),
    text:
      "Recover your Lean Excellence Hub account\n\n" +
      "We received a request to recover access to your Lean Excellence Hub account.\n\n" +
      `Continue account recovery: ${confirmUrl}\n\n` +
      "If you did not request account recovery, you can ignore this email.",
  };
}

export function renderGenericConfirmEmail(
  subject: string,
  title: string,
  intro: string,
  ctaLabel: string,
  confirmUrl: string,
): AuthEmailHtml {
  return {
    subject,
    html: renderBrandedAuthEmail({
      eyebrow: "Lean Excellence Hub",
      title,
      intro,
      ctaLabel,
      confirmUrl,
      footer: "If you did not request this, you can ignore this email.",
    }),
    text: `${title}\n\n${intro}\n\n${ctaLabel}: ${confirmUrl}`,
  };
}

type AuthEmailHtml = {
  subject: string;
  html: string;
  text: string;
};
