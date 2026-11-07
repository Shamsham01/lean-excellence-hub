/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decidePlatformAdminAccess } from "@/modules/platform-admin/access-decision";
import { platformAdminInAppSnapshotSchema } from "@/modules/platform-admin/schemas";
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

describe("platform admin in-app snapshot", () => {
  it("parses unread counts and alert items from the RPC payload", () => {
    expect(
      platformAdminInAppSnapshotSchema.parse({
        unread_count: 1,
        items: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            title: "Organisation founded",
            body: "Acme is provisioning.",
            href: "/org_admin/organisations/abc",
            read_at: null,
            created_at: "2026-11-07T12:00:00.000Z",
            notification_type: "platform_operator",
            event_kind: "organisation.founded",
          },
        ],
      }),
    ).toMatchObject({ unread_count: 1, items: [{ title: "Organisation founded" }] });
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
