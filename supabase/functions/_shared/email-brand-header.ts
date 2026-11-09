import { escapeHtml } from "./notification-delivery/html-escape.ts";

/** Display width/height for the trimmed 1x lockup (`public/email/leh-logo.png`). */
export const EMAIL_LOGO_WIDTH = 200;
export const EMAIL_LOGO_HEIGHT = 40;

export function normalizeEmailAppOrigin(
  origin: string | null | undefined,
): string | null {
  if (!origin) {
    return null;
  }

  const trimmed = origin.trim().replace(/\/$/, "");
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.host) {
      return null;
    }

    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function buildLehEmailLogoUrl(
  appOrigin: string | null | undefined,
): string | null {
  const normalized = normalizeEmailAppOrigin(appOrigin);
  if (!normalized) {
    return null;
  }

  return `${normalized}/email/leh-logo.png`;
}

export function buildLehEmailLogoRetinaUrl(
  appOrigin: string | null | undefined,
): string | null {
  const normalized = normalizeEmailAppOrigin(appOrigin);
  if (!normalized) {
    return null;
  }

  return `${normalized}/email/leh-logo@2x.png`;
}

const WORDMARK = "LEAN EXCELLENCE HUB";

export function renderLehEmailBrandHeader(
  appOrigin: string | null | undefined,
  logoHeight: number = EMAIL_LOGO_HEIGHT,
): string {
  const logoUrl = buildLehEmailLogoUrl(appOrigin);
  const logoUrl2x = buildLehEmailLogoRetinaUrl(appOrigin);

  if (!logoUrl || !logoUrl2x) {
    return `<tr>
              <td style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;padding-bottom:16px;">
                ${WORDMARK}
              </td>
            </tr>`;
  }

  const escapedLogo = escapeHtml(logoUrl);
  const escapedLogo2x = escapeHtml(logoUrl2x);

  return `<tr>
              <td style="padding-bottom:16px;">
                <img src="${escapedLogo}" srcset="${escapedLogo2x} 2x" width="${EMAIL_LOGO_WIDTH}" height="${logoHeight}" alt="Lean Excellence Hub" border="0" style="display:block;width:${EMAIL_LOGO_WIDTH}px;height:${logoHeight}px;max-width:100%;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>`;
}

export function shouldRenderLehEmailEyebrow(
  appOrigin: string | null | undefined,
): boolean {
  return buildLehEmailLogoUrl(appOrigin) === null;
}

export function wrapLehEmailCardBody(
  appOrigin: string | null | undefined,
  bodyHtml: string,
): string {
  const brandHeader = renderLehEmailBrandHeader(appOrigin);

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;">
            ${brandHeader}
            <tr>
              <td style="font-size:14px;line-height:1.6;color:#3f3f46;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
