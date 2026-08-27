import { z } from "zod";

import type { AiProposalType } from "@/platform/ai/types";

export const proposalPayloadSchemas = {
  current_condition_item: z
    .object({
      category: z.string(),
      statement: z.string().min(1),
    })
    .strict(),
  hypothesis: z
    .object({
      statement: z.string().min(1),
      category: z.string().optional(),
      rationale: z.string().optional(),
      parent_hypothesis_id: z.string().uuid().optional(),
    })
    .strict(),
  hypothesis_test: z
    .object({
      hypothesis_id: z.string().uuid(),
      test_question: z.string().min(1),
      expected_result: z.string().min(1),
      method: z.string().optional(),
    })
    .strict(),
  containment: z
    .object({
      description: z.string().min(1),
      rationale: z.string().optional(),
    })
    .strict(),
  countermeasure: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      rationale: z.string().optional(),
      hypothesis_ids: z.array(z.string().uuid()).optional(),
    })
    .strict(),
  universal_action: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      context_role: z.enum(["containment", "countermeasure", "sustainment"]),
    })
    .strict(),
  effectiveness_check: z
    .object({
      criterion: z.string().min(1),
      baseline_description: z.string().optional(),
      target_description: z.string().optional(),
    })
    .strict(),
  sustainment_item: z
    .object({
      what: z.string().min(1),
      check_method: z.string().optional(),
    })
    .strict(),
  session_question: z
    .object({
      session_id: z.string().uuid(),
      body: z.string().min(1),
    })
    .strict(),
  session_summary: z
    .object({
      session_id: z.string().uuid(),
      body: z.string().min(1),
    })
    .strict(),
  lessons_learned: z
    .object({
      what_happened: z.string().min(1),
      what_learned: z.string().min(1),
      standardise: z.string().optional(),
      apply_elsewhere: z.string().optional(),
      notes: z.string().optional(),
    })
    .strict(),
} satisfies Record<AiProposalType, z.ZodType>;

export type ProposalPayload<T extends AiProposalType> = z.infer<
  (typeof proposalPayloadSchemas)[T]
>;

export function validateProposalPayload<T extends AiProposalType>(
  proposalType: T,
  payload: unknown,
): ProposalPayload<T> {
  return proposalPayloadSchemas[proposalType].parse(
    payload,
  ) as ProposalPayload<T>;
}

export function safeValidateProposalPayload<T extends AiProposalType>(
  proposalType: T,
  payload: unknown,
) {
  return proposalPayloadSchemas[proposalType].safeParse(payload);
}

export const PROPOSAL_VALIDATION_USER_MESSAGE =
  "This AI proposal no longer matches the required case format. Please regenerate or edit the proposal.";

export function formatProposalAcceptanceError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return PROPOSAL_VALIDATION_USER_MESSAGE;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Could not accept proposal.";
}

export function sanitizeEnvelopeProposals(
  proposals: Array<{
    proposal_type: AiProposalType;
    payload: Record<string, unknown>;
    explanation: string;
  }>,
): Array<{
  proposal_type: AiProposalType;
  payload: Record<string, unknown>;
  explanation: string;
}> {
  const validated: Array<{
    proposal_type: AiProposalType;
    payload: Record<string, unknown>;
    explanation: string;
  }> = [];

  for (const proposal of proposals) {
    const result = safeValidateProposalPayload(
      proposal.proposal_type,
      proposal.payload,
    );
    if (!result.success) {
      continue;
    }

    validated.push({
      proposal_type: proposal.proposal_type,
      payload: result.data as Record<string, unknown>,
      explanation: proposal.explanation,
    });
  }

  return validated;
}
