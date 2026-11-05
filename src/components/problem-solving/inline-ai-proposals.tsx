"use client";

import { AiProposalCard } from "@/components/problem-solving/ai-proposal-card";

export type InlineAiProposal = {
  id: string;
  proposal_type: string;
  payload_json: Record<string, unknown>;
  human_explanation: string;
  status: string;
};

type InlineAiProposalsProps = {
  proposals: InlineAiProposal[];
  onAccept: (proposal: InlineAiProposal) => void;
  onReject: (proposalId: string) => void;
  onEdit: (proposal: InlineAiProposal) => void;
  busy?: boolean;
};

export function InlineAiProposals({
  proposals,
  onAccept,
  onReject,
  onEdit,
  busy,
}: InlineAiProposalsProps) {
  if (proposals.length === 0) return null;

  return (
    <div className="flex flex-col gap-3" data-testid="pps-inline-proposals">
      {proposals.map((proposal) => (
        <AiProposalCard
          key={proposal.id}
          proposal={proposal}
          {...(busy ? { busy } : {})}
          variant="inline"
          onAccept={() => onAccept(proposal)}
          onReject={onReject}
          onEdit={() => onEdit(proposal)}
        />
      ))}
    </div>
  );
}
