export function buildOrganisationInvitationActivateUrl(
  appOrigin: string,
  invitationToken: string,
  inboxProof: string,
): string {
  const url = new URL(
    `/invitations/${encodeURIComponent(invitationToken)}/activate`,
    appOrigin,
  );
  url.hash = `inbox_proof=${encodeURIComponent(inboxProof)}`;
  return url.toString();
}

type InvitationEmailContent = {
  organisationName: string;
  recipientEmail: string;
  intendedDisplayName?: string | null;
  activateUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderOrganisationInvitationEmail(
  input: InvitationEmailContent,
): { subject: string; html: string; text: string } {
  const greetingName = input.intendedDisplayName?.trim();
  const greeting = greetingName ? `Hello ${greetingName}` : "Hello";
  const orgName = escapeHtml(input.organisationName);
  const subject = `You have been invited to ${input.organisationName}`;
  const activateUrl = escapeHtml(input.activateUrl);

  const introHtml = greetingName
    ? `${escapeHtml(greeting)}, you have been invited to join <strong>${orgName}</strong> on Lean Excellence Hub.`
    : `You have been invited to join <strong>${orgName}</strong> on Lean Excellence Hub.`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;">
            <tr>
              <td style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;padding-bottom:16px;">
                Lean Excellence Hub
              </td>
            </tr>
            <tr>
              <td style="font-size:24px;line-height:1.3;font-weight:700;color:#18181b;padding-bottom:16px;">
                You have been invited
              </td>
            </tr>
            <tr>
              <td style="font-size:16px;line-height:1.6;color:#3f3f46;padding-bottom:24px;">
                ${introHtml} Create your account with the secure link below. Opening this email does not join the organisation.
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${activateUrl}" style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:12px 20px;border-radius:8px;">
                  Create account
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:1.6;color:#71717a;">
                This invitation was sent to ${escapeHtml(input.recipientEmail)}. If you did not expect this, you can ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text =
    `${greeting},\n\n` +
    `You have been invited to join ${input.organisationName} on Lean Excellence Hub.\n\n` +
    `Create your account: ${input.activateUrl}\n\n` +
    `This invitation was sent to ${input.recipientEmail}. Opening the email does not join the organisation. ` +
    `If you did not expect this, ignore this message.`;

  return { subject, html, text };
}
