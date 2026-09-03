import { escapeHtml } from "../html-escape.ts";

type BrandedOperationalEmailSection = {
  heading: string;
  body: string;
};

type BrandedOperationalEmailContent = {
  eyebrow: string;
  title: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  sections?: BrandedOperationalEmailSection[];
  footer?: string;
};

function renderSections(sections: BrandedOperationalEmailSection[]): string {
  return sections
    .map((section) => {
      const heading = escapeHtml(section.heading);
      const body = escapeHtml(section.body);

      return `<tr>
              <td style="font-size:14px;line-height:1.6;color:#3f3f46;padding-bottom:16px;">
                <strong>${heading}</strong><br />
                ${body}
              </td>
            </tr>`;
    })
    .join("");
}

export function renderBrandedOperationalEmail(
  content: BrandedOperationalEmailContent,
): string {
  const eyebrow = escapeHtml(content.eyebrow);
  const title = escapeHtml(content.title);
  const intro = escapeHtml(content.intro);
  const ctaLabel = escapeHtml(content.ctaLabel);
  const ctaUrl = escapeHtml(content.ctaUrl);
  const footer = content.footer ? escapeHtml(content.footer) : "";
  const sections = content.sections ? renderSections(content.sections) : "";

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
            ${sections}
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${ctaUrl}" style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:12px 20px;border-radius:8px;">
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

export function buildOperationalCtaUrl(
  appOrigin: string,
  linkPath: string | null,
): string {
  const normalizedOrigin = appOrigin.replace(/\/$/, "");
  const normalizedPath = linkPath?.startsWith("/") ? linkPath : "/platform";

  return `${normalizedOrigin}${normalizedPath}`;
}
