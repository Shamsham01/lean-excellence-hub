import { describe, expect, it } from "vitest";

import {
  buildLehEmailLogoRetinaUrl,
  buildLehEmailLogoUrl,
  EMAIL_LOGO_HEIGHT,
  EMAIL_LOGO_WIDTH,
  renderLehEmailBrandHeader,
  wrapLehEmailCardBody,
} from "../../supabase/functions/_shared/email-brand-header.ts";

const APP_ORIGIN = "https://leanexcellencehub.com";

describe("LEH email brand header", () => {
  it("builds absolute logo URLs from APP_ORIGIN", () => {
    expect(buildLehEmailLogoUrl(APP_ORIGIN)).toBe(
      "https://leanexcellencehub.com/email/leh-logo.png",
    );
    expect(buildLehEmailLogoRetinaUrl(APP_ORIGIN)).toBe(
      "https://leanexcellencehub.com/email/leh-logo@2x.png",
    );
  });

  it("renders a trimmed logo img with absolute URL and no redundant text wordmark", () => {
    const header = renderLehEmailBrandHeader(APP_ORIGIN);

    expect(header).toContain('alt="Lean Excellence Hub"');
    expect(header).toContain(
      "https://leanexcellencehub.com/email/leh-logo.png",
    );
    expect(header).not.toContain("LEAN EXCELLENCE HUB");
    expect(header).toContain(`width="${EMAIL_LOGO_WIDTH}"`);
    expect(header).toContain(`height="${EMAIL_LOGO_HEIGHT}"`);
    expect(header).toContain("display:block");
  });

  it("omits the logo img when APP_ORIGIN is missing", () => {
    const header = renderLehEmailBrandHeader(null);

    expect(header).not.toContain("<img");
    expect(header).toContain("LEAN EXCELLENCE HUB");
  });

  it("wraps arbitrary email bodies with the shared card shell", () => {
    const html = wrapLehEmailCardBody(APP_ORIGIN, "<p>Alert body</p>");

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Alert body");
    expect(html).toContain("email/leh-logo.png");
  });
});
