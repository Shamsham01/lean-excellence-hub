import { describe, expect, it } from "vitest";

import { resolvePlatformInAppNotificationHref } from "@/modules/platform-shell/notification-target";

const suggestionId = "11111111-1111-4111-8111-111111111111";
const actionId = "22222222-2222-4222-8222-222222222222";
const walkId = "33333333-3333-4333-8333-333333333333";
const auditId = "44444444-4444-4444-8444-444444444444";
const membershipId = "55555555-5555-4555-8555-555555555555";

describe("resolvePlatformInAppNotificationHref", () => {
  it("prefers a stored href when present", () => {
    expect(
      resolvePlatformInAppNotificationHref({
        href: "/platform/actions/custom",
        notification_type: "test",
        dedupe_key: "ignored",
      }),
    ).toBe("/platform/actions/custom");
  });

  it("resolves suggestion submitted review queue links from dedupe_key", () => {
    expect(
      resolvePlatformInAppNotificationHref({
        href: null,
        notification_type: "suggestions.awaiting_review",
        dedupe_key: `suggestion:${suggestionId}:submitted`,
      }),
    ).toBe(
      `/platform/suggestions/review?queue=all&suggestionId=${suggestionId}`,
    );
  });

  it("resolves delegated approval review links", () => {
    expect(
      resolvePlatformInAppNotificationHref({
        href: null,
        notification_type: "suggestions.awaiting_review",
        dedupe_key: `suggestion:${suggestionId}:approval:v3`,
      }),
    ).toBe(
      `/platform/suggestions/review?queue=mine&suggestionId=${suggestionId}`,
    );
  });

  it("resolves author status updates to suggestion detail", () => {
    expect(
      resolvePlatformInAppNotificationHref({
        href: null,
        notification_type: "suggestions.status_accepted",
        dedupe_key: `suggestion:${suggestionId}:status:accepted`,
      }),
    ).toBe(`/platform/suggestions/${suggestionId}`);
  });

  it("resolves overdue action chase rows", () => {
    expect(
      resolvePlatformInAppNotificationHref({
        href: null,
        notification_type: "leanai.chase_overdue_action",
        dedupe_key: `overdue_action:${actionId}:${membershipId}`,
      }),
    ).toBe(`/platform/actions/${actionId}`);
  });

  it("resolves overdue schedule chase rows", () => {
    expect(
      resolvePlatformInAppNotificationHref({
        href: null,
        notification_type: "leanai.chase_overdue_schedule",
        dedupe_key: `overdue_schedule:${walkId}:${membershipId}`,
      }),
    ).toBe("/platform/scheduling");
  });

  it("resolves stale gemba walk chase rows", () => {
    expect(
      resolvePlatformInAppNotificationHref({
        href: null,
        notification_type: "leanai.chase_stale_walk",
        dedupe_key: `stale_walk:${walkId}:${membershipId}`,
      }),
    ).toBe(`/platform/gemba/walks/${walkId}`);
  });

  it("resolves stale 5S audit chase rows", () => {
    expect(
      resolvePlatformInAppNotificationHref({
        href: null,
        notification_type: "leanai.chase_stale_audit",
        dedupe_key: `stale_audit:${auditId}:${membershipId}`,
      }),
    ).toBe(`/platform/5s/audits/${auditId}`);
  });

  it("resolves leanai chase digest summaries", () => {
    expect(
      resolvePlatformInAppNotificationHref({
        href: null,
        notification_type: "leanai.chase_digest",
        dedupe_key: "chase_digest:2026-11-09",
      }),
    ).toBe("/platform/actions");
  });
});
