"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createProblemSolvingAiSession,
  reconcileProblemSolvingAiTurn,
  sendProblemSolvingAiMessage,
} from "@/app/(platform)/platform/problem-solving/ai/actions";
import { invokeProblemSolvingTurnAction } from "@/lib/problem-solving/problem-solving-ai-turn-client";
import { LeanAiMarkdown } from "@/components/leanai/leanai-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  problemSolvingClientTurnError,
  retainProblemSolvingTurnKey,
} from "@/platform/ai/ai-turn-messages";
import type { AiSessionMode, FacilitatorEnvelope } from "@/platform/ai/types";

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
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);
  const pendingTurnRef = useRef<{
    message: string;
    idempotencyKey: string;
  } | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [hasPendingTurn, setHasPendingTurn] = useState(false);

  async function applyCompletedTurn(data: { envelope: FacilitatorEnvelope }) {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.envelope.message,
        envelope: data.envelope,
      },
    ]);
    pendingTurnRef.current = null;
    setHasPendingTurn(false);
    setDraft("");
    setError(null);
    router.refresh();
  }

  async function attemptReconcileTurn(userMessage: string): Promise<boolean> {
    const pending = pendingTurnRef.current;
    if (!pending || pending.message !== userMessage) {
      return false;
    }
    setReconciling(true);
    try {
      const activeSessionId = sessionId ?? (await ensureSession());
      const result = await reconcileProblemSolvingAiTurn({
        caseId,
        sessionId: activeSessionId,
        idempotencyKey: pending.idempotencyKey,
      });
      if (result.error || !result.data) {
        return false;
      }
      if (result.data.state === "completed" && result.data.envelope) {
        await applyCompletedTurn({ envelope: result.data.envelope });
        return true;
      }
      if (result.data.state === "failed" && result.data.message) {
        setError(result.data.message);
        pendingTurnRef.current = null;
        setHasPendingTurn(false);
        return true;
      }
      return false;
    } finally {
      setReconciling(false);
    }
  }

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
    const userMessage = (draftInputRef.current?.value ?? draft).trim();
    if (!userMessage || disabledReason) return;
    setLoading(true);
    setError(null);
    try {
      const activeSessionId = await ensureSession();
      if (
        !pendingTurnRef.current ||
        pendingTurnRef.current.message !== userMessage
      ) {
        pendingTurnRef.current = {
          message: userMessage,
          idempotencyKey: `${activeSessionId}-${crypto.randomUUID()}`,
        };
        setHasPendingTurn(true);
      }
      const idempotencyKey = pendingTurnRef.current.idempotencyKey;

      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

      const result = await invokeProblemSolvingTurnAction({
        invoke: () =>
          sendProblemSolvingAiMessage({
            caseId,
            sessionId: activeSessionId,
            mode,
            stageKey: stageKey ?? null,
            message: userMessage,
            idempotencyKey,
            conversationHistory: messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          }),
        reconcile: () =>
          reconcileProblemSolvingAiTurn({
            caseId,
            sessionId: activeSessionId,
            idempotencyKey,
          }),
      });

      if (result.error || !result.data) {
        throw new Error(result.error ?? "Lean AI failed");
      }

      const payload = result.data;
      if ("envelope" in payload && payload.envelope) {
        await applyCompletedTurn({ envelope: payload.envelope });
        return;
      }

      if ("state" in payload) {
        if (payload.state === "completed" && payload.envelope) {
          await applyCompletedTurn({ envelope: payload.envelope });
          return;
        }
        if (payload.state === "failed") {
          throw new Error(payload.message ?? "Lean AI failed");
        }
      }

      throw new Error("Lean AI did not return a completed turn.");
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Lean AI failed";
      const displayMessage = problemSolvingClientTurnError(message);
      setError(displayMessage);
      if (userMessage && retainProblemSolvingTurnKey(message)) {
        const collected = await attemptReconcileTurn(userMessage);
        if (collected) {
          return;
        }
      }
      if (userMessage) {
        setMessages((previous) => {
          const last = previous.at(-1);
          if (last?.role === "user" && last.content === userMessage) {
            return previous.slice(0, -1);
          }
          return previous;
        });
        setDraft(userMessage);
      }
      if (!retainProblemSolvingTurnKey(message)) {
        pendingTurnRef.current = null;
        setHasPendingTurn(false);
      }
    } finally {
      setLoading(false);
    }
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
              {message.role === "user" ? (
                <p className="break-words whitespace-pre-wrap">
                  {message.content}
                </p>
              ) : (
                <LeanAiMarkdown text={message.content} />
              )}
            </div>
          ))}
        </div>
        <Textarea
          ref={draftInputRef}
          data-testid="lean-ai-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask Lean AI..."
          disabled={Boolean(disabledReason) || loading}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="lean-ai-send"
            onClick={() => handleSend()}
            disabled={Boolean(disabledReason) || loading || reconciling}
          >
            {loading ? "Thinking..." : "Send"}
          </Button>
          {error && hasPendingTurn ? (
            <Button
              type="button"
              variant="outline"
              data-testid="lean-ai-retry-turn"
              disabled={Boolean(disabledReason) || loading || reconciling}
              onClick={() => {
                const pending = pendingTurnRef.current;
                if (!pending) return;
                void (async () => {
                  const collected = await attemptReconcileTurn(pending.message);
                  if (!collected) {
                    void handleSend();
                  }
                })();
              }}
            >
              {reconciling ? "Checking…" : "Retry turn"}
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
