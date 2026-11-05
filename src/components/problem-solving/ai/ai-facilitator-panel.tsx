"use client";

import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createProblemSolvingAiSession,
  reconcileProblemSolvingAiTurn,
  sendProblemSolvingAiMessage,
} from "@/app/(platform)/platform/problem-solving/ai/actions";
import type { InlineAiProposal } from "@/components/problem-solving/inline-ai-proposals";
import { LeanAiMarkdown } from "@/components/leanai/leanai-markdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  problemSolvingClientTurnError,
  retainProblemSolvingTurnKey,
} from "@/platform/ai/ai-turn-messages";
import type { AiSessionMode, FacilitatorEnvelope } from "@/platform/ai/types";
import { cn } from "@/lib/utils";

export type PendingProposal = InlineAiProposal;

type AiFacilitatorPanelProps = {
  caseId: string;
  caseTitle?: string;
  stageKey?: string | null;
  stageTitle?: string | null;
  caseStatus?: string;
  canUseAi: boolean;
  providerAvailable: boolean;
  layout?: "card" | "dock";
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  pendingProposals: PendingProposal[];
  onPendingProposalsChange: (proposals: PendingProposal[]) => void;
  draftOverride?: string;
  onDraftOverrideConsumed?: () => void;
};

const MODES: AiSessionMode[] = ["facilitate", "challenge", "review", "ask"];

function buildGreeting(
  caseTitle: string,
  stageTitle: string | null | undefined,
  stageKey: string | null | undefined,
): string {
  const stage = stageTitle ?? stageKey ?? "this stage";
  return `I'm facilitating **${caseTitle}** at **${stage}**. What should we capture or clarify next? I'll turn your answers into proposals you can accept before anything is saved.`;
}

export function AiFacilitatorPanel({
  caseId,
  caseTitle = "this case",
  stageKey,
  stageTitle,
  caseStatus,
  canUseAi,
  providerAvailable,
  layout = "dock",
  collapsed = false,
  onCollapsedChange,
  pendingProposals,
  onPendingProposalsChange,
  draftOverride,
  onDraftOverrideConsumed,
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
  >(() =>
    caseStatus === "active"
      ? [
          {
            role: "assistant" as const,
            content: buildGreeting(caseTitle, stageTitle, stageKey ?? null),
          },
        ]
      : [],
  );
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingTurnRef = useRef<{
    message: string;
    idempotencyKey: string;
  } | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [hasPendingTurn, setHasPendingTurn] = useState(false);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function applyCompletedTurn(data: {
    envelope: FacilitatorEnvelope;
    pendingProposals?: PendingProposal[];
  }) {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: data.envelope.message,
        envelope: data.envelope,
      },
    ]);
    if (data.pendingProposals) {
      onPendingProposalsChange(data.pendingProposals);
    }
    pendingTurnRef.current = null;
    setHasPendingTurn(false);
    setDraft("");
    setError(null);
    router.push(`/platform/problem-solving/${caseId}`);
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
        await applyCompletedTurn({
          envelope: result.data.envelope,
          ...(result.data.pendingProposals
            ? { pendingProposals: result.data.pendingProposals }
            : {}),
        });
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

      const result = await sendProblemSolvingAiMessage({
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
      });

      if (result.error || !result.data) {
        throw new Error(result.error ?? "Lean AI failed");
      }

      await applyCompletedTurn({
        envelope: result.data.envelope,
        ...(result.data.pendingProposals
          ? { pendingProposals: result.data.pendingProposals }
          : {}),
      });
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

  const shellClass =
    layout === "dock"
      ? cn(
          "pps-lean-ai-copilot flex min-h-0 flex-1 flex-col bg-copilot-surface lg:border-l lg:border-primary/15",
          collapsed ? "lg:w-12 lg:flex-none" : "lg:w-[min(100%,22rem)] xl:w-96",
        )
      : "rounded-xl border border-border bg-card shadow-sm";

  if (layout === "dock" && collapsed) {
    return (
      <aside
        className={shellClass}
        data-testid="pps-lean-ai-copilot"
        aria-label="Lean AI copilot"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="m-2"
          aria-label="Expand Lean AI"
          onClick={() => onCollapsedChange?.(false)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
      </aside>
    );
  }

  return (
    <aside
      className={shellClass}
      data-testid="pps-lean-ai-copilot"
      aria-label="Lean AI copilot"
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3"
        data-testid="lean-ai-panel"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-sm font-semibold">Lean AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="lean-ai-mode" className="sr-only">
            Mode
          </Label>
          <select
            id="lean-ai-mode"
            data-testid="lean-ai-mode"
            className="border-input h-8 max-w-[7rem] rounded-md border bg-background px-2 text-xs"
            value={mode}
            onChange={(event) => setMode(event.target.value as AiSessionMode)}
          >
            {MODES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {layout === "dock" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Collapse Lean AI"
              onClick={() => onCollapsedChange?.(true)}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {disabledReason ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {disabledReason}
          </p>
        ) : null}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 py-3",
            layout === "card" && "max-h-80",
          )}
        >
          <div className="flex flex-col gap-3 text-sm">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  "rounded-lg px-3 py-2",
                  message.role === "user"
                    ? "ml-6 bg-muted/60"
                    : "mr-2 bg-primary/5",
                )}
              >
                {message.role === "user" ? (
                  <p className="break-words whitespace-pre-wrap">
                    {message.content}
                  </p>
                ) : (
                  <LeanAiMarkdown text={message.content} />
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          {pendingProposals.length > 0 ? (
            <p
              className="mt-3 text-xs text-muted-foreground"
              data-testid="lean-ai-proposals"
            >
              {pendingProposals.length} proposal(s) waiting in the stage canvas.
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border bg-card p-3">
          <Textarea
            ref={draftInputRef}
            data-testid="lean-ai-input"
            value={draftOverride ?? draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (draftOverride) {
                onDraftOverrideConsumed?.();
              }
            }}
            placeholder="Reply to Lean AI…"
            className="min-h-[72px] resize-none bg-background"
            disabled={Boolean(disabledReason) || loading}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              className="flex-1"
              data-testid="lean-ai-send"
              onClick={() => handleSend()}
              disabled={Boolean(disabledReason) || loading || reconciling}
            >
              {loading ? "Thinking…" : "Send"}
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
                    const collected = await attemptReconcileTurn(
                      pending.message,
                    );
                    if (!collected) {
                      void handleSend();
                    }
                  })();
                }}
              >
                {reconciling ? "Checking…" : "Retry"}
              </Button>
            ) : null}
          </div>
          {error ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
