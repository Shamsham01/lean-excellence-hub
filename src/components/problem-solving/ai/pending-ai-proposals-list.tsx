"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  acceptProblemSolvingAiProposal,
  rejectProblemSolvingAiProposal,
} from "@/app/(platform)/platform/problem-solving/ai/actions";
import { Button } from "@/components/ui/button";
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
            {emptyHint ?? "No pending proposals. Use Lean AI chat or Draft this stage to create some."}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="text-xs text-muted-foreground">{actionMessage}</p>
        ) : null}
        <div className="flex flex-col gap-3" data-testid="lean-ai-proposals">
          {visible.map((proposal) => (
            <Card key={proposal.id} data-testid="ai-proposal-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {proposal.proposal_type}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>{proposal.human_explanation}</p>
                <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(proposal.payload_json, null, 2)}
                </pre>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    data-testid="ai-proposal-accept"
                    onClick={() => handleAccept(proposal)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="ai-proposal-reject"
                    onClick={() => handleReject(proposal.id)}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
