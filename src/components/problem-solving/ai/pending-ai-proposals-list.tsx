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
  busy?: boolean;
  onAccept?: (proposal: CasePendingAiProposal) => void | Promise<void>;
  onReject?: (proposalId: string) => void | Promise<void>;
  onEdit?: (proposal: CasePendingAiProposal) => void;
};

export function PendingAiProposalsList({
  caseId,
  initialProposals,
  title = "Pending Lean AI proposals",
  emptyHint = null,
  busy,
  onAccept,
  onReject,
  onEdit,
}: PendingAiProposalsListProps) {
  const router = useRouter();
  const [hiddenProposalIds, setHiddenProposalIds] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      initialProposals.filter(
        (row) =>
          row.status === "pending" && !hiddenProposalIds.includes(row.id),
      ),
    [hiddenProposalIds, initialProposals],
  );

  async function defaultAccept(proposal: CasePendingAiProposal) {
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
    setHiddenProposalIds((prev) => [...prev, proposal.id]);
    router.refresh();
  }

  async function defaultReject(proposalId: string) {
    setActionMessage(null);
    const result = await rejectProblemSolvingAiProposal({ caseId, proposalId });
    if (result.error) {
      setActionMessage(result.error);
      return;
    }
    setActionMessage("Proposal rejected.");
    setHiddenProposalIds((prev) => [...prev, proposalId]);
    router.refresh();
  }

  const acceptHandler = onAccept ?? defaultAccept;
  const rejectHandler = onReject ?? defaultReject;

  return (
    <Card data-testid="pps-pending-ai-proposals" className="max-w-full min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-3">
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {emptyHint ??
              "No pending proposals. Use Lean AI chat or Draft this stage to create some."}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="text-xs text-muted-foreground">{actionMessage}</p>
        ) : null}
        <div
          className="flex min-w-0 flex-col gap-3"
          data-testid="lean-ai-proposals"
        >
          {visible.map((proposal) => (
            <AiProposalCard
              key={proposal.id}
              proposal={proposal}
              {...(busy ? { busy } : {})}
              {...(onEdit ? { onEdit: () => onEdit(proposal) } : {})}
              onAccept={() => acceptHandler(proposal)}
              onReject={rejectHandler}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
