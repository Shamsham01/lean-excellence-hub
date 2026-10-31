/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decidePlatformAdminAccess } from "@/modules/platform-admin/access-decision";
import {
  isOrganisationId,
  parseDirectoryQuery,
  parseHistoryPage,
} from "@/modules/platform-admin/directory-query";
import { readPlatformBillingRuntime } from "@/modules/platform-admin/runtime";
import { platformNavigation } from "@/modules/platform-shell/navigation";

describe("platform admin access", () => {
  it("requires an allowlisted identity and MFA before allowing the console", () => {
    expect(
      decidePlatformAdminAccess({
        allowlisted: false,
        assuranceLevel: "aal2",
        rateLimited: false,
        userId: "user-1",
      }),
    ).toBe("denied");
    expect(
      decidePlatformAdminAccess({
        allowlisted: true,
        assuranceLevel: "aal1",
        rateLimited: false,
        userId: "user-1",
      }),
    ).toBe("mfa");
    expect(
      decidePlatformAdminAccess({
        allowlisted: true,
        assuranceLevel: "aal2",
        rateLimited: false,
        userId: "user-1",
      }),
    ).toBe("allowed");
    expect(
      decidePlatformAdminAccess({
        allowlisted: true,
        assuranceLevel: "aal2",
        rateLimited: true,
        userId: "user-1",
      }),
    ).toBe("rate_limited");
    expect(
      decidePlatformAdminAccess({
        allowlisted: false,
        assuranceLevel: null,
        rateLimited: false,
        userId: null,
      }),
    ).toBe("anonymous");
  });

  it("does not link the console from customer navigation", () => {
    expect(JSON.stringify(platformNavigation)).not.toContain("org_admin");
  });
});

describe("platform billing runtime labels", () => {
  it("distinguishes configured Stripe test and live secrets without returning the key", () => {
    expect(
      readPlatformBillingRuntime({
        BILLING_PROVIDER: "stripe",
        STRIPE_SECRET_KEY: "sk_test_example",
      }),
    ).toEqual({
      billingProvider: "stripe",
      selfServiceCheckout: "stripe",
      stripeSecretMode: "test",
    });
    expect(
      readPlatformBillingRuntime({
        BILLING_PROVIDER: "fake",
        STRIPE_SECRET_KEY: "sk_live_example",
      }).stripeSecretMode,
    ).toBe("live");
    expect(
      JSON.stringify(
        readPlatformBillingRuntime({
          STRIPE_SECRET_KEY: "sk_test_hidden_value",
        }),
      ),
    ).not.toContain("sk_test_hidden_value");
  });
});

describe("platform directory query", () => {
  it("bounds search, status, and pages", () => {
    expect(
      parseDirectoryQuery({
        page: "2",
        q: "  harbourfield  ",
        status: "attention",
      }),
    ).toEqual({
      limit: 25,
      offset: 25,
      page: 2,
      search: "harbourfield",
      status: "attention",
    });
    expect(
      parseDirectoryQuery({ page: "-4", q: "x".repeat(200), status: "owner" }),
    ).toMatchObject({
      offset: 0,
      page: 1,
      search: "x".repeat(80),
      status: "all",
    });
    expect(parseHistoryPage("3")).toEqual({ limit: 25, offset: 50, page: 3 });
    expect(isOrganisationId("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isOrganisationId("not-an-id")).toBe(false);
  });
});
