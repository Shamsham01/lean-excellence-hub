import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { isVerifiedAzureIdentity } from "@/modules/identity/oauth-policy";

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function azureUser(overrides: Record<string, unknown> = {}) {
  return {
    email: "person@example.test",
    identities: [
      {
        identity_data: {
          email: "person@example.test",
          tid: tenantId,
          xms_edov: true,
          ...overrides,
        },
        provider: "azure",
      },
    ],
  } as unknown as User;
}

describe("Azure identity policy", () => {
  it("accepts only verified email from the configured tenant", () => {
    expect(isVerifiedAzureIdentity(azureUser(), tenantId)).toBe(true);
    expect(
      isVerifiedAzureIdentity(
        azureUser({ tid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
        tenantId,
      ),
    ).toBe(false);
    expect(
      isVerifiedAzureIdentity(azureUser({ xms_edov: false }), tenantId),
    ).toBe(false);
  });

  it("rejects a provider email that does not match the Auth identity", () => {
    expect(
      isVerifiedAzureIdentity(
        azureUser({ email: "attacker@example.test" }),
        tenantId,
      ),
    ).toBe(false);
  });
});
