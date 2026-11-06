"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  acceptProblemSolvingAiProposal,
  rejectProblemSolvingAiProposal,
} from "@/app/(platform)/platform/problem-solving/ai/actions";
import { AiProposalCard } from "@/components/problem-solving/ai-proposal-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CasePendingAiProposal } from "@/lib/problem-solving/load-case-pending-ai-proposals";

type PendingAiProposalsListProps = {
  caseId: string;
  initialProposals: CasePendingAiProposal[];
  title?: string;
  emptyHint?: string | null;
};

export function PendingAiProposalsList({
  caseId,
  initialProposals,
  title = "Pending Lean AI proposals",
  emptyHint = null,
}: PendingAiProposalsListProps) {
  const router = useRouter();
  const [proposals, setProposals] =
    useState<CasePendingAiProposal[]>(initialProposals);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const visible = useMemo(
    () => proposals.filter((row) => row.status === "pending"),
    [proposals],
  );

  async function handleAccept(proposal: CasePendingAiProposal) {
    setActionMessage(null);
    const result = await acceptProblemSolvingAiProposal({
      caseId,
      proposalId: proposal.id,
      payload: proposal.payload_json,
    });
    if (result.error) {
      setActionMessage(result.error);
      return;
    }
    setActionMessage("Proposal accepted.");
    setProposals((prev) => prev.filter((item) => item.id !== proposal.id));
    router.refresh();
  }

  async function handleReject(proposalId: string) {
    setActionMessage(null);
    const result = await rejectProblemSolvingAiProposal({ caseId, proposalId });
    if (result.error) {
      setActionMessage(result.error);
      return;
    }
    setActionMessage("Proposal rejected.");
    setProposals((prev) => prev.filter((item) => item.id !== proposalId));
    router.refresh();
  }

  return (
    <Card data-testid="pps-pending-ai-proposals">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {emptyHint ??
              "No pending proposals. Use Lean AI chat or Draft this stage to create some."}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="text-xs text-muted-foreground">{actionMessage}</p>
        ) : null}
        <div className="flex flex-col gap-3" data-testid="lean-ai-proposals">
          {visible.map((proposal) => (
            <AiProposalCard
              key={proposal.id}
              proposal={proposal}
              onAccept={() => handleAccept(proposal)}
              onReject={handleReject}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
