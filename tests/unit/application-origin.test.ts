import { describe, expect, it } from "vitest";

import {
  APPLICATION_ORIGIN_CONFIGURATION_ERROR,
  buildInvitationUrl,
  deriveApplicationOriginFromHeaders,
  isLocalApplicationOrigin,
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
});
