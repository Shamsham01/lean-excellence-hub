/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST as acceptInvitationPost } from "@/app/api/auth/invitations/accept/route";

const acceptInvitation = vi.fn();
const resolvePostAuthenticationRedirectPath = vi.fn();

vi.mock("@/modules/identity/invitations", () => ({
  acceptInvitation: (...args: unknown[]) => acceptInvitation(...args),
}));

vi.mock("@/modules/identity/session", () => ({
  resolvePostAuthenticationRedirectPath: (...args: unknown[]) =>
    resolvePostAuthenticationRedirectPath(...args),
}));

const getServerEnvironment = vi.fn();

vi.mock("@/platform/env", () => ({
  getServerEnvironment: () => getServerEnvironment(),
}));

vi.mock("@/platform/supabase/route-handler", () => ({
  createRouteHandlerSupabaseClient: () => ({}),
}));

const canonicalEnvironment = {
  APP_ORIGIN: "https://leanexcellencehub.com",
  AUTH_RATE_LIMIT_PEPPER: "test-pepper-that-is-at-least-32-characters",
  NODE_ENV: "production" as const,
  SUPABASE_SECRET_KEY: "test-secret-key",
};

const invitationToken = "lFrDc8I1cPo76h25La6wblFaqDj2KhMF4dBXxhQAlpo";

function createTrustedAcceptRequest() {
  return new NextRequest(
    "https://deploy-id--lean-excellence-hub.netlify.app/api/auth/invitations/accept",
    {
      method: "POST",
      headers: {
        origin: "null",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
      },
      body: new URLSearchParams({
        token: invitationToken,
      }),
    },
  );
}

describe("invitation accept auth route redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerEnvironment.mockReturnValue(canonicalEnvironment);
    acceptInvitation.mockResolvedValue("membership-id");
    resolvePostAuthenticationRedirectPath.mockResolvedValue("/platform");
  });

  it("redirects successful accepts to the canonical APP_ORIGIN", async () => {
    const response = await acceptInvitationPost(createTrustedAcceptRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "https://leanexcellencehub.com/platform",
    );
  });

  it("redirects failed accepts back to the invitation page", async () => {
    acceptInvitation.mockRejectedValue(new Error("Invitation is unavailable."));

    const response = await acceptInvitationPost(createTrustedAcceptRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      `https://leanexcellencehub.com/invitations/${encodeURIComponent(invitationToken)}?accept_error=1`,
    );
  });
});
