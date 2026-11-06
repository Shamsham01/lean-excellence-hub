"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatProposalPreview,
  proposalTypeLabel,
} from "@/lib/problem-solving/proposal-display";
import { cn } from "@/lib/utils";

export type AiProposalCardModel = {
  id: string;
  proposal_type: string;
  payload_json: Record<string, unknown>;
  human_explanation: string;
};

type AiProposalCardProps = {
  proposal: AiProposalCardModel;
  busy?: boolean;
  variant?: "card" | "inline";
  onAccept: (proposal: AiProposalCardModel) => void | Promise<void>;
  onReject: (proposalId: string) => void | Promise<void>;
  onEdit?: (proposal: AiProposalCardModel) => void | Promise<void>;
};

export function AiProposalCard({
  proposal,
  busy,
  variant = "card",
  onAccept,
  onReject,
  onEdit,
}: AiProposalCardProps) {
  const label = proposalTypeLabel(proposal.proposal_type);
  const preview = formatProposalPreview(
    proposal.proposal_type,
    proposal.payload_json,
    proposal.human_explanation,
  );

  const body = (
    <>
      <p className="text-sm leading-relaxed text-foreground">{preview}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          data-testid="ai-proposal-accept"
          disabled={busy}
          onClick={() => onAccept(proposal)}
        >
          Accept
        </Button>
        {onEdit ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onEdit(proposal)}
          >
            Edit
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={onEdit ? "ghost" : "outline"}
          data-testid="ai-proposal-reject"
          disabled={busy}
          onClick={() => onReject(proposal.id)}
        >
          Reject
        </Button>
      </div>
    </>
  );

  if (variant === "inline") {
    return (
      <article
        data-testid="ai-proposal-card"
        className={cn(
          "rounded-xl border-2 border-dashed border-primary/45 bg-primary/5 p-5 shadow-sm",
        )}
      >
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          Lean AI proposal · {label}
        </p>
        <div className="mt-3 flex flex-col gap-3">{body}</div>
      </article>
    );
  }

  return (
    <Card data-testid="ai-proposal-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">{body}</CardContent>
    </Card>
  );
}
