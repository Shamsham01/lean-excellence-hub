"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { ApplicableUnitsField } from "@/components/organisation/applicable-units-field";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MODULE_SETUP_COPY } from "@/modules/module-setup/copy";
import type { ModuleSetupBuilderSnapshot } from "@/modules/module-setup/ai-builder/snapshot";
import {
  configurationNameWarning,
  findExactConfigurationNameMatch,
} from "@/modules/module-setup/name-match";
import type { UnitSelectOption } from "@/modules/organisation/site-context";

type SendResult =
  | {
      ok: true;
      outcome: "ok" | "invalid_response" | "invalid_proposal";
      conversation: ModuleSetupBuilderSnapshot;
    }
  | {
      ok: false;
      message: string;
      conversation: ModuleSetupBuilderSnapshot | null;
    };

type SetupBuilderWorkspaceProps = {
  moduleLabel: string;
  noun: "5S standard" | "Gemba definition";
  setupHref: string;
  manualHref: string;
  quickStartHref: string;
  starters: string[];
  existingNames: string[];
  units: UnitSelectOption[];
  requiresSiteSelection: boolean;
  showThreshold: boolean;
  initial: ModuleSetupBuilderSnapshot | null;
  unavailableMessage: string | null;
  send: (input: {
    message?: string;
    intent: "answer" | "propose" | "refine" | "retry";
    focus?: { kind: "whole" } | { kind: "section"; sectionIndex: number };
    idempotencyKey?: string;
  }) => Promise<SendResult>;
  createDraft: (
    formData: FormData,
  ) => Promise<
    { ok: true; redirectTo: string } | { ok: false; message: string }
  >;
  discard: () => Promise<{ ok: true } | { ok: false; message: string }>;
};

export function SetupBuilderWorkspace({
  moduleLabel,
  noun,
  setupHref,
  manualHref,
  quickStartHref,
  starters,
  existingNames,
  units,
  requiresSiteSelection,
  showThreshold,
  initial,
  unavailableMessage,
  send,
  createDraft,
  discard,
}: SetupBuilderWorkspaceProps) {
  const router = useRouter();
  const formId = useId();
  const [conversation, setConversation] = useState(initial);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refineIndex, setRefineIndex] = useState<number | "whole" | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const proposal = conversation?.proposal ?? null;
  const nameWarning = proposal
    ? findExactConfigurationNameMatch(proposal.name, existingNames)
    : null;

  function run(
    intent: "answer" | "propose" | "refine" | "retry",
    text = message,
    focus?: { kind: "whole" } | { kind: "section"; sectionIndex: number },
  ) {
    setError(null);
    startTransition(async () => {
      const result = await send({
        message: text,
        intent,
        ...(focus ? { focus } : {}),
        idempotencyKey: crypto.randomUUID(),
      });
      if (result.conversation) {
        setConversation(result.conversation);
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage("");
      setRefineIndex(null);
    });
  }

  if (unavailableMessage) {
    return (
      <section
        className="flex max-w-2xl flex-col gap-4"
        data-testid="module-setup-builder-unavailable"
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          Build with LeanAI
        </h1>
        <p role="status">{unavailableMessage}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="min-h-11">
            <AppLink href={quickStartHref}>LEH Quick Start</AppLink>
          </Button>
          <Button variant="outline" asChild className="min-h-11">
            <AppLink href={manualHref}>Start manually</AppLink>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="module-setup-builder">
      <header className="flex max-w-3xl flex-col gap-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {moduleLabel} · LeanAI
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Build with LeanAI
        </h1>
        <p className="text-sm text-muted-foreground">
          {MODULE_SETUP_COPY.leanAi.description} {MODULE_SETUP_COPY.authority}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section
          className="flex flex-col gap-4"
          aria-labelledby={`${formId}-conversation`}
        >
          <h2 id={`${formId}-conversation`} className="text-sm font-semibold">
            Conversation
          </h2>
          {conversation && conversation.turns.length > 0 ? (
            <ol
              className="flex flex-col gap-3"
              data-testid="module-setup-transcript"
            >
              {conversation.turns.map((turn) => (
                <li
                  key={turn.id}
                  className={
                    turn.role === "user"
                      ? "border-l-2 border-primary pl-3 text-sm"
                      : "text-sm text-muted-foreground"
                  }
                >
                  <p className="text-xs font-medium tracking-wide text-foreground uppercase">
                    {turn.role === "user" ? "You" : "LeanAI"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">
                    {turn.role === "user" ? turn.text : turn.message}
                  </p>
                  {turn.role === "assistant" &&
                  turn.proposalIssues.length > 0 ? (
                    <ul
                      className="mt-2 flex flex-col gap-1 text-sm text-destructive"
                      data-testid="module-setup-proposal-issues"
                    >
                      {turn.proposalIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <div
              className="flex flex-col gap-2"
              data-testid="module-setup-starters"
            >
              {starters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  className="min-h-11 rounded-md border border-border px-3 text-left text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  onClick={() => run("answer", starter)}
                  disabled={pending}
                >
                  {starter}
                </button>
              ))}
            </div>
          )}

          {conversation?.pendingQuestions.map((question) => (
            <p
              key={question.question}
              className="text-sm"
              data-testid="module-setup-question"
            >
              {question.question}
            </p>
          ))}

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (refineIndex === null) {
                run("answer");
                return;
              }
              run(
                "refine",
                message,
                refineIndex === "whole"
                  ? { kind: "whole" }
                  : { kind: "section", sectionIndex: refineIndex },
              );
            }}
          >
            <Label htmlFor={`${formId}-message`}>Message</Label>
            <Textarea
              id={`${formId}-message`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              maxLength={2000}
              data-testid="module-setup-input"
            />
            {error ? (
              <p
                role="alert"
                className="text-sm text-destructive"
                data-testid="module-setup-error"
              >
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                className="min-h-11"
                disabled={pending || !message.trim()}
                data-testid="module-setup-send"
              >
                {pending
                  ? "Sending…"
                  : refineIndex === null
                    ? "Send"
                    : "Refine"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={pending}
                data-testid="module-setup-propose"
                onClick={() => run("propose", message)}
              >
                Propose draft
              </Button>
              {conversation?.lastTurnInvalid ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => run("retry", "")}
                >
                  Try again
                </Button>
              ) : null}
            </div>
          </form>
        </section>

        <section
          className="flex flex-col gap-4"
          aria-labelledby={`${formId}-proposal`}
          data-testid="module-setup-proposal"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`${formId}-proposal`} className="text-sm font-semibold">
              Proposal
            </h2>
            {proposal ? (
              <p
                className="text-xs text-muted-foreground"
                data-testid="module-setup-revision"
              >
                Revision {proposal.revision} · not saved
              </p>
            ) : null}
          </div>
          {proposal ? (
            <div className="flex flex-col gap-4">
              <div>
                <h3
                  className="text-xl font-semibold"
                  data-testid="module-setup-proposal-name"
                >
                  {proposal.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {proposal.description}
                </p>
                {proposal.thresholdPercent != null ? (
                  <p className="mt-2 text-sm">
                    Suggested threshold {proposal.thresholdPercent}%
                  </p>
                ) : null}
              </div>
              {nameWarning ? (
                <p
                  className="text-sm"
                  role="status"
                  data-testid="module-setup-name-warning"
                >
                  {configurationNameWarning({
                    noun,
                    existingName: nameWarning,
                  })}
                </p>
              ) : null}
              {proposal.changeSummary.length > 0 ? (
                <ul className="text-sm text-muted-foreground">
                  {proposal.changeSummary.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              ) : null}
              <ol className="flex flex-col gap-4">
                {proposal.sections.map((section, index) => (
                  <li
                    key={`${section.name}-${index}`}
                    className="border-t border-border pt-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-medium">{section.name}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11"
                        onClick={() => setRefineIndex(index)}
                      >
                        Refine
                      </Button>
                    </div>
                    {section.description ? (
                      <p className="text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    ) : null}
                    <ol className="mt-2 flex flex-col gap-2">
                      {section.items.map((item) => (
                        <li
                          key={item.prompt}
                          className="min-w-0 text-sm break-words"
                        >
                          {item.prompt}
                          {item.typeLabel ? (
                            <span className="mt-1 block text-xs tracking-wide text-muted-foreground uppercase">
                              {item.typeLabel}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
              <Button
                className="min-h-11 w-full sm:w-fit"
                onClick={() => setCreateOpen(true)}
                data-testid="module-setup-create-draft"
              >
                Create draft
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing is proposed yet. Describe how you work, then ask LeanAI to
              propose a draft.
            </p>
          )}
          {conversation?.understanding.length ? (
            <dl className="grid gap-2 text-sm">
              {conversation.understanding.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm sm:flex-row sm:items-center">
        <AppLink
          href={manualHref}
          className="underline-offset-4 hover:underline"
        >
          Set up manually instead
        </AppLink>
        <AppLink
          href={quickStartHref}
          className="underline-offset-4 hover:underline"
        >
          Use LEH Quick Start
        </AppLink>
        <AppLink
          href={setupHref}
          className="underline-offset-4 hover:underline"
        >
          All setup choices
        </AppLink>
        <button
          type="button"
          className="min-h-11 text-left underline-offset-4 hover:underline"
          onClick={() => {
            startTransition(async () => {
              const result = await discard();
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setConversation(null);
              router.refresh();
            });
          }}
        >
          Start over
        </button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="module-setup-create-dialog">
          <DialogHeader>
            <DialogTitle>Create draft</DialogTitle>
            <DialogDescription>
              {MODULE_SETUP_COPY.draftBoundary} LeanAI will not publish it.
            </DialogDescription>
          </DialogHeader>
          {proposal ? (
            <form
              className="flex flex-col gap-4"
              action={(formData) => {
                setCreateError(null);
                startTransition(async () => {
                  const result = await createDraft(formData);
                  if (!result.ok) {
                    setCreateError(result.message);
                    return;
                  }
                  router.push(result.redirectTo);
                });
              }}
            >
              <input
                type="hidden"
                name="proposalMessageId"
                value={proposal.messageId}
              />
              <p className="text-sm">
                <span className="font-medium">{proposal.name}</span>
                {" · "}
                {proposal.sections.length} sections ·{" "}
                {proposal.sections.reduce(
                  (count, section) => count + section.items.length,
                  0,
                )}{" "}
                items
              </p>
              {nameWarning ? (
                <p className="text-sm" role="status">
                  {configurationNameWarning({
                    noun,
                    existingName: nameWarning,
                  })}
                </p>
              ) : null}
              {showThreshold ? (
                <div>
                  <Label htmlFor={`${formId}-threshold`}>
                    Target threshold (%)
                  </Label>
                  <Input
                    id={`${formId}-threshold`}
                    name="threshold"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    defaultValue={proposal.thresholdPercent ?? 80}
                    className="mt-2 min-h-11"
                  />
                </div>
              ) : null}
              <ApplicableUnitsField
                options={units}
                requiresSiteSelection={requiresSiteSelection}
                description="You choose where this draft applies."
              />
              {createError ? (
                <p
                  role="alert"
                  className="text-sm text-destructive"
                  data-testid="module-setup-create-error"
                >
                  {createError}
                </p>
              ) : null}
              <DialogFooter>
                <Button
                  type="submit"
                  className="min-h-11"
                  disabled={pending}
                  data-testid="module-setup-confirm-create"
                >
                  {pending ? "Creating…" : "Create draft"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
