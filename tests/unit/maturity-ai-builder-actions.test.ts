import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MaturityBuilderAccess } from "@/modules/maturity/ai-builder/load";

const rpc = vi.fn();
const access = vi.fn<() => Promise<MaturityBuilderAccess>>();
const findSession = vi.fn();
const readDetail = vi.fn();
const readBoundary = vi.fn();
const writeBoundary = vi.fn();
const loadFacts = vi.fn();
const runTurn = vi.fn();
const revalidatePath = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));
vi.mock("@/platform/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ rpc })),
}));
vi.mock("@/modules/organisations/context", () => ({
  loadCurrentOrganisationIdentity: vi.fn(async () => ({
    organisationId: "org-a",
    organisationName: "Acme Ltd",
    multiSiteIntent: null,
  })),
}));
vi.mock("@/modules/maturity/ai-builder/load", () => ({
  loadMaturityBuilderAccess: () => access(),
  findActiveMaturityBuilderSessionId: (...args: unknown[]) =>
    findSession(...args),
  readMaturityBuilderSessionDetail: (...args: unknown[]) => readDetail(...args),
  readMaturityBuilderBoundary: (...args: unknown[]) => readBoundary(...args),
  writeMaturityBuilderBoundary: (...args: unknown[]) => writeBoundary(...args),
  loadMaturityBuilderOrganisationFacts: (...args: unknown[]) =>
    loadFacts(...args),
}));
vi.mock("@/platform/ai/maturity-builder-orchestrator", () => ({
  runMaturityBuilderTurn: (...args: unknown[]) => runTurn(...args),
}));

import {
  createMaturityDraftFromBuilderProposalAction,
  discardMaturityBuilderConversationAction,
  sendMaturityBuilderMessageAction,
} from "@/app/(platform)/platform/maturity/builder/actions";

import {
  BUILDER_SESSION_ID,
  assistantPayload,
  proposalTurnMessages,
  sessionDetail,
  userMessage,
} from "../fixtures/maturity-ai-builder";

const AVAILABLE: MaturityBuilderAccess = {
  canManage: true,
  available: true,
  reason: null,
  message: null,
};
const PROPOSAL_MESSAGE_ID = "a0000000-0000-4000-8000-000000000004";

function rpcNames() {
  return rpc.mock.calls.map(([name]) => name as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  access.mockResolvedValue(AVAILABLE);
  findSession.mockResolvedValue(BUILDER_SESSION_ID);
  readDetail.mockResolvedValue(sessionDetail(proposalTurnMessages()));
  readBoundary.mockResolvedValue(null);
  loadFacts.mockResolvedValue({
    organisationName: "Acme Ltd",
    units: [],
    jobFunctionNames: [],
    existingFrameworkNames: [],
  });
  runTurn.mockResolvedValue({
    runId: "run-1",
    assistantMessageId: "msg-1",
    responseStatus: "ok",
    proposalStatus: "valid",
    issues: [],
  });
  rpc.mockImplementation(async (name: string) => {
    if (name === "create_ai_coach_session") {
      return { data: BUILDER_SESSION_ID, error: null };
    }
    if (name === "create_maturity_model_draft_from_definition") {
      return { data: "model-1", error: null };
    }
    return { data: null, error: null };
  });
});

describe("sendMaturityBuilderMessageAction", () => {
  it.each([
    [
      {
        canManage: false,
        available: false,
        reason: "manage_permission_required",
        message: "You need permission to manage Maturity Frameworks.",
      },
      "permission_denied",
    ],
    [
      {
        canManage: true,
        available: false,
        reason: "organisation_ai_disabled",
        message: "LeanAI is turned off for this organisation.",
      },
      "organisation_ai_disabled",
    ],
    [
      {
        canManage: true,
        available: false,
        reason: "ai_permission_required",
        message: "Your role does not include LeanAI.",
      },
      "permission_denied",
    ],
  ] as const)(
    "denies before any session or model call (%o)",
    async (denied, reason) => {
      access.mockResolvedValue(denied as MaturityBuilderAccess);
      const result = await sendMaturityBuilderMessageAction({
        intent: "answer",
        message: "Assess our sites",
      });
      expect(result).toMatchObject({ ok: false, reason });
      expect(rpc).not.toHaveBeenCalled();
      expect(runTurn).not.toHaveBeenCalled();
    },
  );

  it("starts a builder Coach session and never writes framework records", async () => {
    readDetail.mockResolvedValue(sessionDetail([]));
    const result = await sendMaturityBuilderMessageAction({
      intent: "answer",
      message: "  Assess how our sites apply standards  ",
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
    });

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("create_ai_coach_session", {
      target_module_key: "maturity",
      target_intervention_key: "maturity_framework_builder",
      target_title: "LeanAI Maturity Framework builder",
      target_context_contract_version: "maturity-builder-context-v1",
    });
    expect(runTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: BUILDER_SESSION_ID,
        userRequest: "Assess how our sites apply standards",
        intent: "answer",
        focus: null,
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
      }),
    );
    expect(rpcNames().some((name) => name.includes("maturity_model"))).toBe(
      false,
    );
    expect(writeBoundary).not.toHaveBeenCalled();
  });

  it("replaces a non-UUID idempotency key", async () => {
    await sendMaturityBuilderMessageAction({
      intent: "answer",
      message: "Hi",
      idempotencyKey: "not-a-uuid",
    });
    const key = runTurn.mock.calls[0]?.[0].idempotencyKey as string;
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("refines in the same authorised session using the server proposal", async () => {
    const result = await sendMaturityBuilderMessageAction({
      intent: "refine",
      message: "rename it to Right First Time",
      focus: { kind: "pillar", pillarIndex: 1 },
    });
    expect(result.ok).toBe(true);
    const input = runTurn.mock.calls[0]?.[0];
    expect(input.sessionId).toBe(BUILDER_SESSION_ID);
    expect(input.userRequest).toBe(
      "Refine pillar “Quality at Source”: rename it to Right First Time",
    );
    expect(input.focus).toEqual({ kind: "pillar", pillarIndex: 1 });
    expect(input.context.current_proposal.pillars).toHaveLength(3);
    expect(input.context.request).toEqual({
      intent: "refine",
      focus: "pillar “Quality at Source”",
      retry: false,
    });
  });

  it("rejects a refinement focus that is not in the current proposal", async () => {
    const result = await sendMaturityBuilderMessageAction({
      intent: "refine",
      message: "change it",
      focus: { kind: "criterion", pillarIndex: 1, criterionIndex: 4 },
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid_request" });
    expect(runTurn).not.toHaveBeenCalled();
  });

  it("retries the latest request with its original intent and focus", async () => {
    readDetail.mockResolvedValue(
      sessionDetail([
        ...proposalTurnMessages(),
        userMessage(
          "a0000000-0000-4000-8000-000000000005",
          "Refine pillar “Safe Work”: make it about leadership",
          "2026-10-06T10:02:00.000000+00:00",
        ),
        {
          id: "a0000000-0000-4000-8000-000000000006",
          role: "assistant",
          content: "Could not be used.",
          created_at: "2026-10-06T10:02:01.000000+00:00",
          structured_payload: assistantPayload({
            phase: "proposal",
            intent: "refine",
            focus: { kind: "pillar", pillarIndex: 0 },
            response_status: "invalid_response",
          }),
        },
      ]),
    );
    await sendMaturityBuilderMessageAction({ intent: "retry" });
    const input = runTurn.mock.calls[0]?.[0];
    expect(input.userRequest).toBe(
      "Refine pillar “Safe Work”: make it about leadership",
    );
    expect(input.intent).toBe("refine");
    expect(input.focus).toEqual({ kind: "pillar", pillarIndex: 0 });
    expect(input.context.request.retry).toBe(true);
  });

  it("stops at the conversation turn limit without calling the model", async () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      userMessage(
        `b0000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        `Turn ${index}`,
        `2026-10-06T10:${String(index).padStart(2, "0")}:00.000000+00:00`,
      ),
    );
    readDetail.mockResolvedValue(sessionDetail(messages));
    const result = await sendMaturityBuilderMessageAction({
      intent: "answer",
      message: "One more",
    });
    expect(result).toMatchObject({ ok: false, reason: "usage_limit" });
    expect(runTurn).not.toHaveBeenCalled();
  });

  it("maps database usage ceilings and returns the saved conversation", async () => {
    runTurn.mockRejectedValue({
      message: "organisation ai monthly token ceiling reached",
    });
    const result = await sendMaturityBuilderMessageAction({
      intent: "answer",
      message: "Hello",
    });
    expect(result).toMatchObject({ ok: false, reason: "usage_limit" });
    expect(result.conversation?.currentProposal?.messageId).toBe(
      PROPOSAL_MESSAGE_ID,
    );
  });

  it("rejects over-long messages before any work", async () => {
    const result = await sendMaturityBuilderMessageAction({
      intent: "answer",
      message: "x".repeat(2001),
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid_request" });
    expect(access).not.toHaveBeenCalled();
  });
});

describe("createMaturityDraftFromBuilderProposalAction", () => {
  it("creates a DRAFT from the trusted server proposal only", async () => {
    const result = await createMaturityDraftFromBuilderProposalAction({
      proposalMessageId: PROPOSAL_MESSAGE_ID,
    });
    expect(result).toEqual({
      ok: true,
      modelId: "model-1",
      redirectTo: "/platform/maturity/models/model-1?step=review",
    });
    const call = rpc.mock.calls.find(
      ([name]) => name === "create_maturity_model_draft_from_definition",
    );
    const args = call?.[1] as {
      target_declared_template_key: string;
      target_definition: {
        key: string;
        name: string;
        levels: Array<{ colorToken: string }>;
        pillars: Array<{ criteria: Array<{ questions: unknown[] }> }>;
      };
    };
    expect(args.target_declared_template_key).toBe("leanai-maturity-builder");
    expect(args.target_definition.key).toBe("leanai-maturity-builder");
    expect(args.target_definition.name).toBe("Acme Operating Standard");
    expect(args.target_definition.levels.map((l) => l.colorToken)).toEqual([
      "maturity-1",
      "maturity-2",
      "maturity-3",
      "maturity-4",
    ]);
    expect(
      args.target_definition.pillars.map((pillar) =>
        pillar.criteria.map((criterion) => criterion.questions.length),
      ),
    ).toEqual([[2, 1], [1], [1, 2]]);
    expect(rpcNames().some((name) => name.includes("publish"))).toBe(false);
    expect(writeBoundary).toHaveBeenCalledWith(
      "org-a",
      "2026-10-06T10:01:02.001Z",
    );
  });

  it("refuses a stale or unknown proposal id", async () => {
    const result = await createMaturityDraftFromBuilderProposalAction({
      proposalMessageId: "a0000000-0000-4000-8000-000000000002",
    });
    expect(result).toMatchObject({ ok: false, reason: "stale_proposal" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a malformed id before reading anything", async () => {
    const result = await createMaturityDraftFromBuilderProposalAction({
      proposalMessageId: "'; drop table",
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid_request" });
    expect(access).not.toHaveBeenCalled();
  });

  it("denies members without maturity.models.manage", async () => {
    access.mockResolvedValue({
      canManage: false,
      available: false,
      reason: "manage_permission_required",
      message: "You need permission to manage Maturity Frameworks.",
    });
    const result = await createMaturityDraftFromBuilderProposalAction({
      proposalMessageId: PROPOSAL_MESSAGE_ID,
    });
    expect(result).toMatchObject({ ok: false, reason: "permission_denied" });
    expect(rpc).not.toHaveBeenCalled();
    expect(findSession).not.toHaveBeenCalled();
  });

  it("reports database RBAC denial without moving the boundary", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "maturity model creation is not authorised" },
    });
    const result = await createMaturityDraftFromBuilderProposalAction({
      proposalMessageId: PROPOSAL_MESSAGE_ID,
    });
    expect(result).toMatchObject({
      ok: false,
      reason: "permission_denied",
      message: "You do not have permission to create Maturity Frameworks.",
    });
    expect(writeBoundary).not.toHaveBeenCalled();
  });
});

describe("discardMaturityBuilderConversationAction", () => {
  it("moves the logical boundary without database writes", async () => {
    await expect(discardMaturityBuilderConversationAction()).resolves.toEqual({
      ok: true,
    });
    expect(writeBoundary).toHaveBeenCalledWith(
      "org-a",
      "2026-10-06T10:01:02.001Z",
    );
    expect(
      rpc.mock.calls.filter(([name]) => name !== "get_ai_session_detail"),
    ).toEqual([]);
  });

  it("denies members who cannot manage frameworks", async () => {
    access.mockResolvedValue({
      canManage: false,
      available: false,
      reason: "manage_permission_required",
      message: "x",
    });
    await expect(
      discardMaturityBuilderConversationAction(),
    ).resolves.toMatchObject({
      ok: false,
    });
    expect(writeBoundary).not.toHaveBeenCalled();
  });
});
