import { describe, expect, it } from "vitest";

import {
  APPLICATION_ORIGIN_CONFIGURATION_ERROR,
  buildInvitationUrl,
  deriveApplicationOriginFromHeaders,
  isLocalApplicationOrigin,
  requestHasTrustedOrigin,
  resolveApplicationOrigin,
} from "@/platform/application-origin";

describe("application origin resolution", () => {
  it("uses configured production APP_ORIGIN for invitation links", () => {
    const result = resolveApplicationOrigin({
      environment: {
        APP_ORIGIN: "https://lean-excellence-hub.netlify.app",
        NODE_ENV: "production",
      },
    });

    expect(result).toEqual({
      ok: true,
      origin: "https://lean-excellence-hub.netlify.app",
    });
    expect(
      buildInvitationUrl(result.ok ? result.origin : "", "invite-token"),
    ).toBe("https://lean-excellence-hub.netlify.app/invitations/invite-token");
  });

  it("allows localhost in local development", () => {
    const result = resolveApplicationOrigin({
      environment: {
        APP_ORIGIN: "http://127.0.0.1:3000",
        NODE_ENV: "development",
      },
    });

    expect(result).toEqual({
      ok: true,
      origin: "http://127.0.0.1:3000",
    });
    expect(
      buildInvitationUrl(result.ok ? result.origin : "", "local-invite-token"),
    ).toBe("http://127.0.0.1:3000/invitations/local-invite-token");
  });

  it("does not silently return localhost in production when origin is unavailable", () => {
    const result = resolveApplicationOrigin({
      environment: {
        APP_ORIGIN: "http://127.0.0.1:3000",
        NODE_ENV: "production",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: APPLICATION_ORIGIN_CONFIGURATION_ERROR,
    });
  });

  it("derives production origin from forwarded headers when APP_ORIGIN is local", () => {
    const requestHeaders = new Headers({
      "x-forwarded-host": "lean-excellence-hub.netlify.app",
      "x-forwarded-proto": "https",
    });

    const result = resolveApplicationOrigin({
      environment: {
        APP_ORIGIN: "http://127.0.0.1:3000",
        NODE_ENV: "production",
      },
      requestHeaders,
    });

    expect(result).toEqual({
      ok: true,
      origin: "https://lean-excellence-hub.netlify.app",
    });
    expect(
      buildInvitationUrl(result.ok ? result.origin : "", "forwarded-token"),
    ).toBe(
      "https://lean-excellence-hub.netlify.app/invitations/forwarded-token",
    );
  });

  it("keeps invitation token and path unchanged", () => {
    const token = "a1b2c3d4e5f6";
    expect(buildInvitationUrl("https://example.com", token)).toBe(
      `https://example.com/invitations/${token}`,
    );
  });
});

describe("application origin helpers", () => {
  it("identifies local application origins", () => {
    expect(isLocalApplicationOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalApplicationOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(
      isLocalApplicationOrigin("https://lean-excellence-hub.netlify.app"),
    ).toBe(false);
  });

  it("derives origin from the first forwarded host and protocol", () => {
    const requestHeaders = new Headers({
      host: "ignored.internal",
      "x-forwarded-host": "app.example.com, proxy.internal",
      "x-forwarded-proto": "https,http",
    });

    expect(deriveApplicationOriginFromHeaders(requestHeaders)).toBe(
      "https://app.example.com",
    );
  });

  it("accepts trusted origin and referer proofs for same-origin requests", () => {
    const environment = {
      APP_ORIGIN: "http://127.0.0.1:3000",
    };

    expect(
      requestHasTrustedOrigin(
        new Request("http://127.0.0.1:3000/api/auth/workforce", {
          headers: { origin: "http://127.0.0.1:3000" },
        }),
        environment,
      ),
    ).toBe(true);

    expect(
      requestHasTrustedOrigin(
        new Request("http://127.0.0.1:3000/api/auth/workforce", {
          headers: {
            referer: "http://127.0.0.1:3000/workforce-login",
          },
        }),
        environment,
      ),
    ).toBe(true);

    expect(
      requestHasTrustedOrigin(
        new Request("http://127.0.0.1:3000/api/auth/workforce", {
          headers: { origin: "http://localhost:3000" },
        }),
        environment,
      ),
    ).toBe(true);

    expect(
      requestHasTrustedOrigin(
        new Request("http://127.0.0.1:3000/api/auth/workforce"),
        environment,
      ),
    ).toBe(false);

    expect(
      requestHasTrustedOrigin(
        new Request("http://127.0.0.1:3000/api/auth/workforce", {
          headers: { origin: "https://evil.example" },
        }),
        environment,
      ),
    ).toBe(false);
  });

  it("accepts same-origin HTML form navigation with Origin null and fetch metadata", () => {
    const environment = {
      APP_ORIGIN: "https://leanexcellencehub.com",
    };

    expect(
      requestHasTrustedOrigin(
        new Request("https://leanexcellencehub.com/api/auth/workforce", {
          headers: {
            origin: "null",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
          },
        }),
        environment,
      ),
    ).toBe(true);

    expect(
      requestHasTrustedOrigin(
        new Request("https://leanexcellencehub.com/api/auth/workforce", {
          headers: {
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
          },
        }),
        environment,
      ),
    ).toBe(true);
  });

  it("rejects unsafe Origin null and missing fetch-metadata workforce login attempts", () => {
    const environment = {
      APP_ORIGIN: "https://leanexcellencehub.com",
    };
    const sameOriginNavigation = {
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
    } as const;

    expect(
      requestHasTrustedOrigin(
        new Request("https://leanexcellencehub.com/api/auth/workforce", {
          headers: {
            origin: "null",
            "sec-fetch-site": "cross-site",
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
          },
        }),
        environment,
      ),
    ).toBe(false);

    expect(
      requestHasTrustedOrigin(
        new Request("https://leanexcellencehub.com/api/auth/workforce", {
          headers: {
            origin: "null",
            "sec-fetch-site": "none",
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
          },
        }),
        environment,
      ),
    ).toBe(false);

    expect(
      requestHasTrustedOrigin(
        new Request("https://leanexcellencehub.com/api/auth/workforce", {
          headers: {
            origin: "null",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "cors",
            "sec-fetch-dest": "document",
          },
        }),
        environment,
      ),
    ).toBe(false);

    expect(
      requestHasTrustedOrigin(
        new Request("https://leanexcellencehub.com/api/auth/workforce", {
          headers: {
            origin: "null",
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "empty",
          },
        }),
        environment,
      ),
    ).toBe(false);

    expect(
      requestHasTrustedOrigin(
        new Request("https://leanexcellencehub.com/api/auth/workforce"),
        environment,
      ),
    ).toBe(false);

    expect(
      requestHasTrustedOrigin(
        new Request("https://leanexcellencehub.com/api/auth/workforce", {
          headers: {
            origin: "https://evil.example",
            ...sameOriginNavigation,
          },
        }),
        environment,
      ),
    ).toBe(false);

    expect(
      requestHasTrustedOrigin(
        new Request("https://leanexcellencehub.com/api/auth/workforce", {
          headers: {
            referer: "https://evil.example/workforce-login",
            ...sameOriginNavigation,
          },
        }),
        environment,
      ),
    ).toBe(false);
  });
});
