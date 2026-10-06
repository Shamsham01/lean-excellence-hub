"use client";

import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  createMaturityDraftFromBuilderProposalAction,
  discardMaturityBuilderConversationAction,
  sendMaturityBuilderMessageAction,
} from "@/app/(platform)/platform/maturity/builder/actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  MaturityBuilderConversationState,
  MaturityBuilderRequestIntent,
} from "@/modules/maturity/ai-builder/types";

import {
  MATURITY_BUILDER_STARTERS,
  MaturityBuilderComposer,
  MaturityBuilderTranscript,
} from "./maturity-builder-conversation";
import { CreateDraftDialog, DiscardDialog } from "./maturity-builder-dialogs";
import {
  MaturityBuilderProposal,
  type MaturityBuilderRefineTarget,
} from "./maturity-builder-proposal";
import { MaturityBuilderUnderstandingPanel } from "./maturity-builder-understanding";

type MobileView = "conversation" | "proposal";

type Submission = {
  intent: MaturityBuilderRequestIntent;
  message: string;
  focus: MaturityBuilderRefineTarget["focus"] | null;
};

export function MaturityBuilderWorkspace({
  initialConversation,
  maxMessageChars,
  maxTurns,
}: {
  initialConversation: MaturityBuilderConversationState | null;
  maxMessageChars: number;
  maxTurns: number;
}) {
  const router = useRouter();
  const [conversation, setConversation] = useState(initialConversation);
  const [draft, setDraft] = useState("");
  const [refineTarget, setRefineTarget] =
    useState<MaturityBuilderRefineTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedSubmission, setFailedSubmission] = useState<Submission | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState("");
  const [mobileView, setMobileView] = useState<MobileView>(
    initialConversation?.currentProposal ? "proposal" : "conversation",
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [createPending, startCreate] = useTransition();
  const [discardPending, startDiscard] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const proposalHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const lastRevision = useRef(
    initialConversation?.currentProposal?.revision ?? 0,
  );

  const turns = conversation?.turns ?? [];
  const current = conversation?.currentProposal ?? null;
  const isEmpty = turns.length === 0;
  const busy = pending || createPending || discardPending;
  const turnsUsed = conversation?.userTurnCount ?? 0;
  const atTurnLimit = turnsUsed >= maxTurns;
  const step = current ? 2 : 1;

  useEffect(() => {
    const revision = current?.revision ?? 0;
    if (revision > lastRevision.current) {
      lastRevision.current = revision;
      setAnnouncement(
        revision === 1
          ? "LeanAI proposal is ready to review."
          : `Proposal revision ${revision} is ready to review.`,
      );
      setMobileView("proposal");
      proposalHeadingRef.current?.focus({ preventScroll: false });
    }
  }, [current?.revision]);

  function submit(submission: Submission) {
    if (busy) {
      return;
    }
    setError(null);
    setFailedSubmission(null);
    startTransition(async () => {
      const result = await sendMaturityBuilderMessageAction({
        intent: submission.intent,
        message: submission.message,
        focus: submission.focus,
        idempotencyKey: crypto.randomUUID(),
      });
      if (result.conversation) {
        setConversation(result.conversation);
      }
      if (!result.ok) {
        setError(result.message);
        if (result.reason === "provider_error" || result.reason === "timeout") {
          setFailedSubmission(submission);
        }
        setAnnouncement(result.message);
        return;
      }
      setDraft("");
      setRefineTarget(null);
      if (result.outcome !== "ok") {
        setAnnouncement(
          "LeanAI's reply could not be used. Nothing changed. You can try again.",
        );
      } else if (!result.conversation.currentProposal) {
        setAnnouncement("LeanAI replied.");
      }
    });
  }

  function handleSend() {
    const message = draft.trim();
    if (!message) {
      return;
    }
    submit(
      refineTarget
        ? { intent: "refine", message, focus: refineTarget.focus }
        : { intent: "answer", message, focus: null },
    );
  }

  function handleRetry() {
    submit(failedSubmission ?? { intent: "retry", message: "", focus: null });
  }

  function handleRefine(target: MaturityBuilderRefineTarget) {
    setRefineTarget(target);
    setMobileView("conversation");
    setDraft("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleCreate() {
    if (!current) {
      return;
    }
    setCreateError(null);
    startCreate(async () => {
      const result = await createMaturityDraftFromBuilderProposalAction({
        proposalMessageId: current.messageId,
      });
      if (!result.ok) {
        setCreateError(result.message);
        return;
      }
      router.push(result.redirectTo);
    });
  }

  function handleDiscard() {
    startDiscard(async () => {
      const result = await discardMaturityBuilderConversationAction();
      if (!result.ok) {
        setError(result.message);
        setDiscardOpen(false);
        return;
      }
      setConversation(null);
      setDraft("");
      setRefineTarget(null);
      setError(null);
      setFailedSubmission(null);
      setMobileView("conversation");
      lastRevision.current = 0;
      setDiscardOpen(false);
      setAnnouncement("Builder cleared. Start a new conversation.");
      requestAnimationFrame(() => textareaRef.current?.focus());
      router.refresh();
    });
  }

  const showRetry =
    !pending &&
    (failedSubmission !== null || conversation?.lastTurnInvalid === true);

  return (
    <div
      className="@container flex flex-col gap-4"
      data-testid="maturity-builder-workspace"
    >
      <BuilderSteps step={step} />

      {current ? (
        <div
          className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/50 p-1 @4xl:hidden"
          role="group"
          aria-label="Builder view"
          data-testid="maturity-builder-view-toggle"
        >
          {(["conversation", "proposal"] as const).map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={mobileView === view}
              onClick={() => setMobileView(view)}
              className={cn(
                "min-h-11 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none",
                mobileView === view
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`maturity-builder-view-${view}`}
            >
              {view === "conversation"
                ? "Conversation"
                : `Proposal · rev ${current.revision}`}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @4xl:items-start">
        <section
          aria-labelledby="maturity-builder-discovery-title"
          className={cn(
            "min-w-0",
            current && mobileView !== "conversation" && "hidden @4xl:block",
          )}
          data-testid="maturity-builder-conversation-pane"
        >
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex flex-col gap-1">
                <h2
                  id="maturity-builder-discovery-title"
                  className="text-base font-semibold text-foreground"
                >
                  {current ? "Refine with LeanAI" : "Discovery"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {current
                    ? "Choose Refine on any part of the proposal, or ask a question."
                    : "Describe what you want to assess. LeanAI asks a few short questions, then proposes a structure in your language."}
                </p>
              </div>

              {isEmpty ? (
                <div
                  className="flex flex-col gap-2"
                  data-testid="maturity-builder-starters"
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    Starting points
                  </p>
                  {MATURITY_BUILDER_STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setDraft(starter);
                        textareaRef.current?.focus();
                      }}
                      className="min-h-11 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 motion-reduce:transition-none"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="max-h-[28rem] min-h-0 overflow-y-auto pr-1 @4xl:max-h-[32rem]">
                  <MaturityBuilderTranscript turns={turns} pending={pending} />
                </div>
              )}
              {isEmpty && pending ? (
                <MaturityBuilderTranscript turns={[]} pending />
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground"
                  data-testid="maturity-builder-error"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              ) : null}

              {showRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRetry}
                  disabled={busy || atTurnLimit}
                  data-testid="maturity-builder-retry"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Try again
                </Button>
              ) : null}

              <MaturityBuilderComposer
                value={draft}
                onChange={setDraft}
                onSubmit={handleSend}
                onPropose={() =>
                  submit({ intent: "propose", message: "", focus: null })
                }
                showPropose={!current && !isEmpty}
                pending={pending}
                disabled={busy || atTurnLimit}
                refineTarget={refineTarget}
                onCancelRefine={() => setRefineTarget(null)}
                questions={conversation?.pendingQuestions ?? []}
                maxChars={maxMessageChars}
                textareaRef={textareaRef}
                isEmpty={isEmpty}
              />
              <p className="text-xs text-muted-foreground tabular-nums">
                {turnsUsed} of {maxTurns} messages used in this conversation
              </p>
            </CardContent>
          </Card>
        </section>

        <section
          aria-label={current ? "Proposal review" : "Discovery summary"}
          className={cn(
            "min-w-0",
            current && mobileView !== "proposal" && "hidden @4xl:block",
          )}
          data-testid="maturity-builder-proposal-pane"
        >
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
              {conversation?.lastTurnInvalid && !pending ? (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground"
                  data-testid="maturity-builder-invalid-proposal"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-warning-foreground"
                    aria-hidden="true"
                  />
                  <span>
                    LeanAI&apos;s latest reply did not pass validation, so it
                    was not used.
                    {current
                      ? " The proposal below is unchanged."
                      : " No proposal has been accepted yet."}{" "}
                    Try again or rephrase your request.
                  </span>
                </div>
              ) : null}

              {current ? (
                <>
                  <details className="group rounded-lg border border-border px-3 py-2">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                      What LeanAI understands so far
                    </summary>
                    <div className="pt-2 pb-1">
                      <MaturityBuilderUnderstandingPanel
                        understanding={conversation?.understanding ?? null}
                      />
                    </div>
                  </details>
                  <MaturityBuilderProposal
                    current={current}
                    headingRef={proposalHeadingRef}
                    disabled={busy}
                    onRefine={handleRefine}
                  />
                </>
              ) : (
                <>
                  <MaturityBuilderUnderstandingPanel
                    understanding={conversation?.understanding ?? null}
                  />
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
                    <Sparkles
                      className="mx-auto size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-sm font-medium text-foreground">
                      Your proposal will appear here
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                      You review it before anything is saved. Creating a draft
                      is always your decision, and publishing happens later in
                      the editor.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
            {current ? (
              <div
                className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-b-lg border-t border-border bg-card/95 px-4 py-3 pr-16 backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:flex-row sm:flex-wrap sm:items-center sm:px-5 lg:pr-5"
                data-testid="maturity-builder-actions"
              >
                <Button
                  type="button"
                  onClick={() => {
                    setCreateError(null);
                    setCreateOpen(true);
                  }}
                  disabled={busy}
                  data-testid="maturity-builder-create-draft"
                >
                  Create draft framework
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDiscardOpen(true)}
                  disabled={busy}
                  data-testid="maturity-builder-discard"
                >
                  Start over
                </Button>
                <AppLink
                  href="/platform/maturity/models#maturity-manual-create"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:ml-auto"
                >
                  Set up manually instead
                </AppLink>
              </div>
            ) : null}
          </Card>
          {!current && !isEmpty ? (
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDiscardOpen(true)}
                disabled={busy}
                data-testid="maturity-builder-discard"
              >
                Start over
              </Button>
            </div>
          ) : null}
        </section>
      </div>

      <p
        className="sr-only"
        aria-live="polite"
        data-testid="maturity-builder-announcement"
      >
        {announcement}
      </p>

      {current ? (
        <CreateDraftDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          current={current}
          pending={createPending}
          error={createError}
          onConfirm={handleCreate}
        />
      ) : null}
      <DiscardDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        pending={discardPending}
        hasProposal={Boolean(current)}
        onConfirm={handleDiscard}
      />
    </div>
  );
}

function BuilderSteps({ step }: { step: 1 | 2 }) {
  const steps = ["Discover", "Review proposal", "Create draft"] as const;
  return (
    <ol
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
      aria-label="Builder progress"
      data-testid="maturity-builder-steps"
    >
      {steps.map((label, index) => {
        const number = index + 1;
        const state =
          number < step ? "complete" : number === step ? "current" : "upcoming";
        return (
          <li
            key={label}
            className="flex items-center gap-2"
            aria-current={state === "current" ? "step" : undefined}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                state === "current" && "bg-primary text-primary-foreground",
                state === "complete" && "bg-success/15 text-success",
                state === "upcoming" && "bg-muted text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {number}
            </span>
            <span
              className={
                state === "upcoming"
                  ? "text-muted-foreground"
                  : "font-medium text-foreground"
              }
            >
              {label}
            </span>
            {index < steps.length - 1 ? (
              <span
                className="hidden h-px w-6 bg-border sm:block"
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
