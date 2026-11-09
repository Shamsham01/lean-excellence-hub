import { describe, expect, it } from "vitest";

import {
  isLocalSupabaseInvitationDeliveryRuntime,
  resolveInvitationDeliveryMailpitCaptureUrl,
} from "../../supabase/functions/_shared/organisation-invitation-delivery/mailpit-capture-policy.ts";

describe("invitation delivery mailpit capture policy", () => {
  const localEnv = (overrides: Record<string, string | undefined>) => {
    return (name: string) =>
      overrides[name] ??
      {
        SUPABASE_URL: "http://127.0.0.1:54321",
        INVITATION_DELIVERY_MAILPIT_URL: "http://127.0.0.1:54324",
      }[name];
  };

  it("allows allowlisted Mailpit URLs on local Supabase only", () => {
    expect(
      resolveInvitationDeliveryMailpitCaptureUrl(
        localEnv({
          INVITATION_DELIVERY_MAILPIT_URL: "http://host.docker.internal:54324/",
        }),
      ),
    ).toBe("http://host.docker.internal:54324");
  });

  it("rejects Mailpit capture on non-local Supabase", () => {
    expect(() =>
      resolveInvitationDeliveryMailpitCaptureUrl((name) =>
        name === "SUPABASE_URL"
          ? "https://project-ref.supabase.co"
          : name === "INVITATION_DELIVERY_MAILPIT_URL"
            ? "http://127.0.0.1:54324"
            : undefined,
      ),
    ).toThrow(/only permitted for local/i);
  });

  it("rejects arbitrary external capture endpoints", () => {
    expect(() =>
      resolveInvitationDeliveryMailpitCaptureUrl(
        localEnv({
          INVITATION_DELIVERY_MAILPIT_URL: "http://evil.example.test:54324",
        }),
      ),
    ).toThrow(/allowlist/i);
  });

  it("detects local Supabase runtime by hostname", () => {
    expect(
      isLocalSupabaseInvitationDeliveryRuntime((name) =>
        name === "SUPABASE_URL" ? "http://127.0.0.1:54321" : undefined,
      ),
    ).toBe(true);
    expect(
      isLocalSupabaseInvitationDeliveryRuntime((name) =>
        name === "SUPABASE_URL" ? "http://kong:8000" : undefined,
      ),
    ).toBe(true);
    expect(
      isLocalSupabaseInvitationDeliveryRuntime((name) =>
        name === "SUPABASE_URL" ? "https://prod-ref.supabase.co" : undefined,
      ),
    ).toBe(false);
    expect(
      isLocalSupabaseInvitationDeliveryRuntime((name) =>
        name === "SUPABASE_URL"
          ? "https://not-local-127.0.0.1.evil.test"
          : undefined,
      ),
    ).toBe(false);
  });
});
