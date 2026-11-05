"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        <article
          key={proposal.id}
          data-testid="ai-proposal-card"
          className={cn(
            "rounded-xl border-2 border-dashed border-primary/45 bg-primary/5 p-5 shadow-sm",
          )}
        >
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Lean AI proposal · {proposal.proposal_type}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {proposal.human_explanation}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              data-testid="ai-proposal-accept"
              disabled={busy}
              onClick={() => onAccept(proposal)}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onEdit(proposal)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="ai-proposal-reject"
              disabled={busy}
              onClick={() => onReject(proposal.id)}
            >
              Reject
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
