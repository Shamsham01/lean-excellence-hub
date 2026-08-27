"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  acceptProblemSolvingAiProposal,
  createProblemSolvingAiSession,
  rejectProblemSolvingAiProposal,
  sendProblemSolvingAiMessage,
} from "@/app/(platform)/platform/problem-solving/ai/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AiSessionMode, FacilitatorEnvelope } from "@/platform/ai/types";

type PendingProposal = {
  id: string;
  proposal_type: string;
  payload_json: Record<string, unknown>;
  human_explanation: string;
  status: string;
};

type AiFacilitatorPanelProps = {
  caseId: string;
  stageKey?: string | null;
  canUseAi: boolean;
  providerAvailable: boolean;
};

const MODES: AiSessionMode[] = ["facilitate", "challenge", "review", "ask"];

export function AiFacilitatorPanel({
  caseId,
  stageKey,
  canUseAi,
  providerAvailable,
}: AiFacilitatorPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AiSessionMode>("facilitate");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Array<{
      role: "user" | "assistant";
      content: string;
      envelope?: FacilitatorEnvelope;
    }>
  >([]);
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>(
    [],
  );
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const disabledReason = !canUseAi
    ? "You do not have permission to use Lean AI on this case."
    : !providerAvailable
      ? "Lean AI is not enabled or configured for this environment."
      : null;

  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId;
    const result = await createProblemSolvingAiSession({ caseId, mode });
    if (result.error || !result.data?.sessionId) {
      throw new Error(result.error ?? "Could not create AI session");
    }
    setSessionId(result.data.sessionId);
    return result.data.sessionId;
  }

  async function handleSend() {
    if (!draft.trim() || disabledReason) return;
    setLoading(true);
    setError(null);
    try {
      const activeSessionId = await ensureSession();
      const userMessage = draft.trim();
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
      setDraft("");

      const result = await sendProblemSolvingAiMessage({
        caseId,
        sessionId: activeSessionId,
        mode,
        stageKey: stageKey ?? null,
        message: userMessage,
        idempotencyKey: `${activeSessionId}-${Date.now()}`,
        conversationHistory: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });

      if (result.error || !result.data) {
        throw new Error(result.error ?? "Lean AI failed");
      }

      const data = result.data;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.envelope.message,
          envelope: data.envelope,
        },
      ]);
      if (data.pendingProposals) {
        setPendingProposals(data.pendingProposals);
      }
      router.refresh();
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Lean AI failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(proposal: PendingProposal) {
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
    setPendingProposals((prev) =>
      prev.filter((item) => item.id !== proposal.id),
    );
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
    setPendingProposals((prev) =>
      prev.filter((item) => item.id !== proposalId),
    );
    router.refresh();
  }

  return (
    <Card data-testid="lean-ai-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Lean AI</CardTitle>
        <div className="flex items-center gap-2">
          <Label
            htmlFor="lean-ai-mode"
            className="text-xs text-muted-foreground"
          >
            Mode
          </Label>
          <select
            id="lean-ai-mode"
            data-testid="lean-ai-mode"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={mode}
            onChange={(event) => setMode(event.target.value as AiSessionMode)}
          >
            {MODES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {stageKey ? (
          <p className="text-xs text-muted-foreground">
            Case stage: {stageKey}
          </p>
        ) : null}
        {disabledReason ? (
          <p className="text-sm text-muted-foreground">{disabledReason}</p>
        ) : null}
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-md border p-3">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className="text-sm">
              <p className="font-medium capitalize">{message.role}</p>
              <p>{message.content}</p>
            </div>
          ))}
        </div>
        <Textarea
          data-testid="lean-ai-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask Lean AI..."
          disabled={Boolean(disabledReason) || loading}
        />
        <Button
          data-testid="lean-ai-send"
          onClick={() => handleSend()}
          disabled={Boolean(disabledReason) || loading || !draft.trim()}
        >
          {loading ? "Thinking..." : "Send"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {actionMessage ? (
          <p className="text-xs text-muted-foreground">{actionMessage}</p>
        ) : null}
        <div className="flex flex-col gap-3" data-testid="lean-ai-proposals">
          {pendingProposals.map((proposal) => (
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
