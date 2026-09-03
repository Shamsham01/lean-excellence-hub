import { describe, expect, it } from "vitest";

import { escapeHtml } from "../../supabase/functions/_shared/notification-delivery/html-escape.ts";
import { renderOperationalNotification } from "../../supabase/functions/_shared/notification-delivery/renderer/registry.ts";
import {
  JOB_FUNCTION_ASSIGNED_KIND,
  RECOGNITION_AWARDED_KIND,
  SKILL_PROFICIENCY_VALIDATED_KIND,
  SUGGESTION_APPROVED_KIND,
  SUGGESTION_DECLINED_KIND,
  SUGGESTION_PARKED_KIND,
  SUGGESTION_REVIEW_STARTED_KIND,
  SUGGESTION_REVIEWER_ASSIGNED_KIND,
  SUGGESTION_REVIEWER_REASSIGNED_KIND,
  TRAINING_COMPLETED_KIND,
} from "../../supabase/functions/_shared/notification-delivery/renderer/renderers.ts";
import type { NotificationDeliveryContext } from "../../supabase/functions/_shared/notification-delivery/types.ts";

const APP_ORIGIN = "https://hub.example.test";

function buildContext(
  notificationKind: string,
  overrides: Partial<NotificationDeliveryContext> = {},
): NotificationDeliveryContext {
  return {
    organisationId: "11111111-1111-4111-8111-111111111111",
    organisationName: "Acme Manufacturing",
    deliveryId: "22222222-2222-4222-8222-222222222222",
    sourceDomainEventId: "33333333-3333-4333-8333-333333333333",
    notificationKind,
    recipientMembershipId: "44444444-4444-4444-8444-444444444444",
    recipientDisplayName: "Alex Operator",
    recipientResolutionStatus: "deliverable",
    deliverableEmail: "alex@example.test",
    eventType: "Event",
    resourceRecordId: null,
    eventPayload: {},
    contextTitle: "Sample title",
    contextDetail: "Sample detail",
    contextLinkPath: "/platform",
    ...overrides,
  };
}

describe("notification renderers", () => {
  it.each([
    JOB_FUNCTION_ASSIGNED_KIND,
    TRAINING_COMPLETED_KIND,
    SKILL_PROFICIENCY_VALIDATED_KIND,
    RECOGNITION_AWARDED_KIND,
    SUGGESTION_REVIEWER_ASSIGNED_KIND,
    SUGGESTION_REVIEWER_REASSIGNED_KIND,
    SUGGESTION_REVIEW_STARTED_KIND,
    SUGGESTION_APPROVED_KIND,
    SUGGESTION_DECLINED_KIND,
    SUGGESTION_PARKED_KIND,
  ])("renders subject, text, and html for %s", (notificationKind) => {
    const rendered = renderOperationalNotification(
      buildContext(notificationKind),
      APP_ORIGIN,
    );

    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.text.length).toBeGreaterThan(0);
    expect(rendered.html).toContain("Lean Excellence Hub");
    expect(rendered.html).toContain(APP_ORIGIN);
  });

  it("produces stable output across retry", () => {
    const context = buildContext(TRAINING_COMPLETED_KIND, {
      contextTitle: "Forklift Safety",
      contextLinkPath: "/platform/training/matrix",
    });

    const first = renderOperationalNotification(context, APP_ORIGIN);
    const second = renderOperationalNotification(context, APP_ORIGIN);

    expect(second).toEqual(first);
  });

  it("escapes HTML injection payloads in dynamic values", () => {
    const rendered = renderOperationalNotification(
      buildContext(RECOGNITION_AWARDED_KIND, {
        recipientDisplayName: '<script>alert("xss")</script>',
        organisationName: 'Acme <img src=x onerror="alert(1)">',
        contextTitle: "<b>Unsafe</b>",
        contextDetail: "<i>Unsafe detail</i>",
      }),
      APP_ORIGIN,
    );

    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain(
      escapeHtml('<script>alert("xss")</script>'),
    );
    expect(rendered.html).not.toContain("<img src=x");
    expect(rendered.text).toContain('<script>alert("xss")</script>');
  });

  it("uses module-level deep links when provided", () => {
    const rendered = renderOperationalNotification(
      buildContext(SKILL_PROFICIENCY_VALIDATED_KIND, {
        contextLinkPath: "/platform/skills/matrix",
      }),
      APP_ORIGIN,
    );

    expect(rendered.text).toContain(`${APP_ORIGIN}/platform/skills/matrix`);
  });

  it("renders reviewer assignment deep links and CTA labels", () => {
    const suggestionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const rendered = renderOperationalNotification(
      buildContext(SUGGESTION_REVIEWER_ASSIGNED_KIND, {
        contextTitle: "A & B <Improvement>",
        contextLinkPath: `/platform/suggestions/review?queue=mine&suggestionId=${suggestionId}`,
      }),
      APP_ORIGIN,
    );

    expect(rendered.subject).toBe(
      "Suggestion assigned for review: A & B <Improvement>",
    );
    expect(rendered.text).toContain("Review suggestion:");
    expect(rendered.text).toContain(
      `/platform/suggestions/review?queue=mine&suggestionId=${suggestionId}`,
    );
    expect(rendered.html).toContain("Review suggestion");
    expect(rendered.html).not.toContain("<Improvement>");
  });

  it("escapes hostile suggestion titles in suggestion emails", () => {
    const rendered = renderOperationalNotification(
      buildContext(SUGGESTION_APPROVED_KIND, {
        contextTitle: "<script>alert(1)</script>",
        contextLinkPath: "/platform/suggestions",
      }),
      APP_ORIGIN,
    );

    expect(rendered.subject).toContain("<script>alert(1)</script>");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.text).not.toContain("<script>");
  });

  it("does not include parked rationale in parked notification copy", () => {
    const rendered = renderOperationalNotification(
      buildContext(SUGGESTION_PARKED_KIND, {
        contextTitle: "Parked idea",
        contextDetail: "Your suggestion was parked for further consideration",
        eventPayload: { decision: "park", rationale: "secret reviewer note" },
      }),
      APP_ORIGIN,
    );

    expect(rendered.text).not.toContain("secret reviewer note");
    expect(rendered.html).not.toContain("secret reviewer note");
  });
});
