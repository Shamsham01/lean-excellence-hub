import { describe, expect, it } from "vitest";

import {
  CATEGORY_MEANING,
  PROGRAMME_MEANING,
  assistantPageDefinitionFor,
} from "@/modules/leanai-context/assistant/product-pages";
import { parseAssistantRoute } from "@/modules/leanai-context/assistant/route-map";
import { selectAssistantIntervention } from "@/modules/leanai-context/assistant/select-recommendation";
import {
  buildSuggestionsSetupState,
  suggestionsSetupGuidance,
} from "@/modules/leanai-context/assistant/suggestions-state";
import { buildMaturityAuthoringState } from "@/modules/leanai-context/assistant/maturity-state";
import { coachPageContextFromView } from "@/modules/leanai-context/assistant/page-context";
import type { LeanAiAssistantView } from "@/modules/leanai-context/assistant/types";
import {
  countUserTurnsAfterBoundary,
  failClosedConversationStartedAt,
  filterConversationAfterBoundary,
  parseConversationBoundary,
  validateConversationBoundary,
} from "@/modules/leanai-context/assistant/conversation-boundary";
import { coachProductKnowledgeFor } from "@/modules/leanai-context/coach/product-knowledge";
import { visibleCoachUserMessage } from "@/modules/leanai-context/coach/session-validation";
import {
  LEANAI_INTERVENTION_PERMISSION_KEYS,
  leanAiInterventionByKey,
} from "@/modules/leanai-context/interventions/catalogue";
import {
  emptyOrganisationFacts,
  evaluateSetupReadinessFromFacts,
} from "@/modules/leanai-context/readiness";
import type { LeanAiContextualSnapshot } from "@/modules/leanai-context/types";

function allPermissions(enabled = true): Record<string, boolean> {
  return Object.fromEntries(
    LEANAI_INTERVENTION_PERMISSION_KEYS.map((key) => [key, enabled]),
  );
}

function snapshotFromFacts(
  facts = emptyOrganisationFacts(),
  organisationId = "org-a",
): LeanAiContextualSnapshot {
  return {
    readiness: evaluateSetupReadinessFromFacts(facts, organisationId),
    journey: {
      organisationId,
      membershipId: "membership-a",
      recentModuleKey: null,
      recentModuleOpenedAt: null,
      onboardingStatus: "completed",
      lastOnboardingStepKey: null,
      lastOnboardingEventKey: null,
      lastOnboardingAt: null,
      lastInterventionKey: null,
      lastInterventionAt: null,
      lastInterventionEventKey: null,
      interventionStates: [],
    },
    retention: { eventRetentionDays: 90, cleanupAvailable: true },
    applicationAiAvailable: false,
    proactiveAssistanceEnabled: true,
    webSearchEnabled: false,
  };
}

describe("LeanAI assistant route context", () => {
  it("maps Suggestions configuration to programme workflow", () => {
    const identity = parseAssistantRoute("/platform/suggestions/programmes");
    expect(identity.module).toBe("suggestions");
    expect(identity.workflow).toBe("programme_configuration");
    expect(identity.surface).toBe("suggestions");
    expect(identity.pageTitle).toBe("Suggestions configuration");
  });

  it("maps Maturity authoring model id and active step from the query string", () => {
    const modelId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const identity = parseAssistantRoute(
      `/platform/maturity/models/${modelId}`,
      "?step=questions",
    );
    expect(identity.workflow).toBe("maturity_authoring");
    expect(identity.entityId).toBe(modelId);
    expect(identity.authoringStep).toBe("questions");
    expect(identity.surface).toBe("maturity");
  });

  it("updates only the authoring step when the Maturity tab changes", () => {
    const modelId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const details = parseAssistantRoute(
      `/platform/maturity/models/${modelId}`,
      "",
    );
    const questions = parseAssistantRoute(
      `/platform/maturity/models/${modelId}`,
      "step=questions",
    );
    expect(details.entityId).toBe(questions.entityId);
    expect(details.workflow).toBe(questions.workflow);
    expect(details.authoringStep).toBe("details");
    expect(questions.authoringStep).toBe("questions");
  });

  it("does not trust a non-UUID model id from the browser", () => {
    const identity = parseAssistantRoute(
      "/platform/maturity/models/not-a-uuid?step=questions",
    );
    expect(identity.workflow).toBe("maturity_authoring");
    expect(identity.entityId).toBeNull();
  });

  it("maps Organisation structure to a dedicated Structure context", () => {
    const identity = parseAssistantRoute("/platform/settings/structure");
    const page = assistantPageDefinitionFor(identity);
    expect(identity.workflow).toBe("structure");
    expect(page.contextLabel).toBe("Organisation · Structure");
    expect(page.starterPrompts).toEqual([
      "Recommend a structure",
      "Explain organisational units",
      "How should I structure my organisation?",
      "What should go under this site?",
    ]);
  });

  it("keeps assistant presence on other setup pages", () => {
    const routes = [
      "/platform/setup",
      "/platform/settings/structure",
      "/platform/settings/job-functions",
      "/platform/settings/people",
      "/platform/maturity",
      "/platform/suggestions",
      "/platform/5s/standards",
      "/platform/gemba/definitions",
      "/platform/training",
      "/platform/skills",
      "/platform/recognition/types",
      "/platform/settings/ai",
    ];
    for (const route of routes) {
      const identity = parseAssistantRoute(route);
      expect(identity.pathname.startsWith("/platform")).toBe(true);
      expect(identity.pageTitle.length).toBeGreaterThan(0);
    }
    expect(parseAssistantRoute("/platform/settings/people").workflow).toBe(
      "people",
    );
  });
});

describe("LeanAI programme versus category product knowledge", () => {
  it("does not describe a programme as holding categories", () => {
    const knowledge = coachProductKnowledgeFor("suggestions");
    const explain = leanAiInterventionByKey(
      "suggestions_programme_setup",
    )?.explain;
    const page = assistantPageDefinitionFor(
      parseAssistantRoute("/platform/suggestions/programmes"),
    );
    const combined = [
      knowledge.summary,
      ...knowledge.facts,
      explain,
      page.summary,
      ...page.facts,
      PROGRAMME_MEANING,
      CATEGORY_MEANING,
    ].join(" ");
    expect(combined).not.toMatch(/programme holds categories/i);
    expect(combined).toMatch(/organisation-level/);
    expect(PROGRAMME_MEANING).toMatch(/campaign/i);
    expect(CATEGORY_MEANING).toMatch(/not children of a programme/i);
  });
});

describe("LeanAI assistant intervention selection", () => {
  it("prefers the Suggestions gap while on Suggestions even if sites are incomplete", () => {
    const recommendation = selectAssistantIntervention({
      snapshot: snapshotFromFacts(),
      permissions: allPermissions(),
      pageSurface: "suggestions",
    });
    expect(recommendation?.key).toBe("suggestions_programme_setup");
  });

  it("falls back to the next workspace gap when the current module is ready", () => {
    const recommendation = selectAssistantIntervention({
      snapshot: snapshotFromFacts({
        ...emptyOrganisationFacts(),
        suggestionProgrammeCount: 1,
        activePublishedSuggestionProgrammeCount: 1,
      }),
      permissions: allPermissions(),
      pageSurface: "suggestions",
    });
    expect(recommendation?.key).toBe("sites_first_setup");
  });

  it("hides restricted CTAs", () => {
    const recommendation = selectAssistantIntervention({
      snapshot: snapshotFromFacts(),
      permissions: allPermissions(false),
      pageSurface: "workspace",
    });
    expect(recommendation).toBeNull();
  });

  it("still ranks when application AI is disabled", () => {
    const snapshot = snapshotFromFacts();
    expect(snapshot.applicationAiAvailable).toBe(false);
    const recommendation = selectAssistantIntervention({
      snapshot,
      permissions: allPermissions(),
      pageSurface: "workspace",
    });
    expect(recommendation?.key).toBe("sites_first_setup");
  });
});

describe("Suggestions setup context", () => {
  it("separates programmes, published versions, and categories", () => {
    const state = buildSuggestionsSetupState({
      programmes: [
        { id: "p1", name: "Continuous Improvement", status: "active" },
      ],
      versions: [{ programme_id: "p1", lifecycle: "draft" }],
      categories: [{ id: "c1", name: "Safety", status: "active" }],
      canManageProgrammes: true,
    });
    expect(state.relevantState.submissionsPossible).toBe(false);
    expect(state.relevantState.categoryCount).toBe(1);
    expect(state.relevantState.draftVersionCount).toBe(1);
    expect(suggestionsSetupGuidance(state)).toMatch(/not active and published/);
    expect(suggestionsSetupGuidance(state)).toMatch(/separate catalogue/);
  });

  it("treats an active published programme as submission-ready", () => {
    const state = buildSuggestionsSetupState({
      programmes: [{ id: "p1", name: "CI", status: "active" }],
      versions: [{ programme_id: "p1", lifecycle: "published" }],
      categories: [{ id: "c1", name: "Quality", status: "active" }],
      canManageProgrammes: true,
    });
    expect(state.relevantState.submissionsPossible).toBe(true);
    expect(suggestionsSetupGuidance(state)).toMatch(
      /can currently be submitted/,
    );
  });
});

describe("Maturity authoring context", () => {
  it("includes the framework name, step, and publish blockers", () => {
    const state = buildMaturityAuthoringState({
      model: {
        id: "model-1",
        displayName: "Business System",
        description: "Operational excellence",
      },
      authoringStep: "questions",
      versionStatus: "draft",
      assessmentScopes: ["site"],
      levels: [{ name: "Developing" }],
      pillars: [
        {
          id: "pillar-1",
          name: "Technology & Delivery",
          position: 1,
          section_id: "section-1",
        },
      ],
      criteria: [
        {
          id: "criterion-1",
          name: "Delivery reliability",
          pillar_id: "pillar-1",
          position: 1,
        },
      ],
      questions: [],
      canManage: true,
    });
    expect(state.contextLabel).toBe("Maturity · Business System · Questions");
    expect(state.relevantState.authoringStep).toBe("questions");
    expect(state.relevantState.publishReady).toBe(false);
    expect(
      state.remaining.some((item) => item.includes("Delivery reliability")),
    ).toBe(true);
    expect(state.allowedActions.join(" ")).not.toMatch(
      /publish it automatically/i,
    );
  });
});

describe("Coach history display", () => {
  it("maps server-resolved organisation name independently from the active site", () => {
    const view: LeanAiAssistantView = {
      organisationId: "org-a",
      membershipId: "mem-a",
      organisation: { name: "HODL Token Club" },
      capabilities: { webSearchEnabled: false },
      applicationAiAvailable: true,
      conversationAvailable: true,
      conversationUnavailableReason: null,
      contextLabel: "LeanAI Settings",
      page: {
        module: "lean_ai",
        workflow: "lean_ai_settings",
        route: "/platform/settings/ai",
        pageTitle: "LeanAI Settings",
        authoringStep: null,
        entityValidated: false,
      },
      site: { mode: "site", activeSiteName: "The Club" },
      terminology: [],
      starterPrompts: [],
      summary: "LeanAI settings",
      remainingSetup: [],
      relevantState: {},
      allowedActions: [],
      recommendation: null,
    };
    const page = coachPageContextFromView(view);
    expect(page.organisationName).toBe("HODL Token Club");
    expect(page.activeSiteName).toBe("The Club");
    expect(page.organisationName).not.toBe(page.activeSiteName);
    expect(page.pageTitle).toBe("LeanAI Settings");
  });

  it("shows only the user request from wrapped Coach turns", () => {
    const stored = [
      "UNTRUSTED_ORGANISATION_DATA_START",
      JSON.stringify({ route: "/platform/suggestions/programmes" }),
      "UNTRUSTED_ORGANISATION_DATA_END",
      "",
      "User request:",
      "What is a programme?",
    ].join("\n");
    expect(visibleCoachUserMessage(stored)).toBe("What is a programme?");
  });
});

describe("LeanAI logical conversation boundary", () => {
  it("accepts ISO timestamps and rejects far-future or malformed values", () => {
    const valid = "2026-10-02T12:00:00.000Z";
    expect(parseConversationBoundary(undefined).kind).toBe("none");
    expect(parseConversationBoundary(valid)).toEqual({
      kind: "valid",
      startedAt: valid,
    });
    expect(parseConversationBoundary("not-a-date").kind).toBe("invalid");
    expect(parseConversationBoundary("2099-01-01T00:00:00.000Z").kind).toBe(
      "invalid",
    );
    expect(validateConversationBoundary(valid)).toBe(valid);
    expect(validateConversationBoundary("nope")).toBeNull();
  });

  it("fail-closes invalid boundaries without treating them as missing", () => {
    expect(failClosedConversationStartedAt(undefined)).toBeNull();
    const closed = failClosedConversationStartedAt("tomorrow");
    expect(closed).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
  });

  it("hides conversation A from history and turn counts after New", () => {
    const messages = [
      {
        role: "user" as const,
        content: "A",
        createdAt: "2026-10-01T10:00:00.000Z",
      },
      {
        role: "assistant" as const,
        content: "A reply",
        createdAt: "2026-10-01T10:00:01.000Z",
      },
      {
        role: "user" as const,
        content: "B",
        createdAt: "2026-10-02T12:00:00.000Z",
      },
    ];
    const boundary = "2026-10-02T11:00:00.000Z";
    expect(countUserTurnsAfterBoundary(messages, null)).toBe(2);
    expect(countUserTurnsAfterBoundary(messages, boundary)).toBe(1);
    expect(filterConversationAfterBoundary(messages, boundary)).toEqual([
      messages[2],
    ]);
  });
});
