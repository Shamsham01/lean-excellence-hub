import type { AiProposalType } from "@/platform/ai/types";
import {
  safeValidateProposalPayload,
  type ProposalPayload,
} from "@/platform/ai/proposals/contracts";

export type BufferedAiProposal = {
  proposal_type: AiProposalType;
  payload: Record<string, unknown>;
  explanation: string;
};

export class ProblemSolvingProposalBuffer {
  private readonly items: BufferedAiProposal[] = [];

  queue<T extends AiProposalType>(
    proposalType: T,
    payload: ProposalPayload<T>,
    explanation: string,
  ): BufferedAiProposal {
    const trimmedExplanation = explanation.trim();
    if (trimmedExplanation.length === 0) {
      throw new Error("Proposal explanation is required.");
    }
    const validated = safeValidateProposalPayload(proposalType, payload);
    if (!validated.success) {
      throw new Error("Proposal payload failed validation.");
    }
    const entry: BufferedAiProposal = {
      proposal_type: proposalType,
      payload: validated.data as Record<string, unknown>,
      explanation: trimmedExplanation,
    };
    this.items.push(entry);
    return entry;
  }

  drain(): BufferedAiProposal[] {
    return [...this.items];
  }

  clear(): void {
    this.items.length = 0;
  }
}
