"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { LeanAiCoachCard } from "@/components/leanai/leanai-coach-card";
import { useLeanAiAssistant } from "@/components/leanai/leanai-assistant-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hardNavigate } from "@/lib/navigation/navigate";
import { cn } from "@/lib/utils";

export function LeanAiAssistantPanel({
  onClose,
  closeLabel,
}: {
  onClose: () => void;
  closeLabel: string;
}) {
  const {
    view,
    viewLoading,
    viewError,
    messages,
    sending,
    chatError,
    sendMessage,
    clearConversation,
  } = useLeanAiAssistant();
  const inputId = useId();
  const feedRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (messages.length === 0 && !sending) {
      return;
    }
    const node = feedRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages, sending]);

  const conversationAvailable = view?.conversationAvailable === true;
  const contextLabel = view?.contextLabel ?? "Workspace";

  return (
    <section
      role="region"
      aria-label="LeanAI assistant"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
      data-testid="leanai-assistant-pane"
      data-context-label={contextLabel}
      data-module={view?.page.module ?? ""}
      data-workflow={view?.page.workflow ?? ""}
      data-authoring-step={view?.page.authoringStep ?? ""}
      data-conversation-available={conversationAvailable ? "true" : "false"}
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-border px-3 py-3">
        <div
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
          aria-hidden
        >
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            LeanAI
          </p>
          <p
            className="truncate text-sm font-semibold text-foreground"
            data-testid="leanai-assistant-context-label"
          >
            {viewLoading ? "Loading context…" : contextLabel}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={clearConversation}
          disabled={sending}
          aria-label="Start a new LeanAI conversation"
          data-testid="leanai-assistant-new-conversation"
        >
          New
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label={closeLabel}
          data-testid="leanai-assistant-close"
        >
          Close
        </Button>
      </header>

      <div
        ref={feedRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-3 break-words"
        data-testid="leanai-assistant-feed"
        aria-live="polite"
        aria-relevant="additions"
      >
        {viewError ? (
          <p className="text-sm text-destructive" role="alert">
            {viewError}
          </p>
        ) : null}

        {view ? (
          <div className="rounded-md border border-border bg-accent/30 px-3 py-3 text-sm leading-relaxed text-foreground">
            <p data-testid="leanai-assistant-summary">{view.summary}</p>
            {view.remainingSetup.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                {view.remainingSetup.slice(0, 4).map((item) => (
                  <li key={`${item.key}:${item.reason}`}>{item.reason}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted-foreground">
                Nothing obvious is missing on this page.
              </p>
            )}
            {view.terminology.length > 0 ? (
              <dl className="mt-3 space-y-2">
                {view.terminology.slice(0, 3).map((entry) => (
                  <div key={entry.term}>
                    <dt className="font-medium text-foreground">
                      {entry.term}
                    </dt>
                    <dd className="text-muted-foreground">{entry.meaning}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

        {view?.recommendation ? (
          <LeanAiCoachCard
            key={`${view.recommendation.organisationId}:${view.recommendation.key}`}
            recommendation={view.recommendation}
            presentation="compact"
            surface={
              view.page.module === "suggestions"
                ? "suggestions"
                : view.page.module === "maturity"
                  ? "maturity"
                  : view.page.workflow === "organisation_setup"
                    ? "setup"
                    : "workspace"
            }
            applicationAiAvailable={view.applicationAiAvailable}
          />
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "rounded-md px-3 py-2 text-sm leading-relaxed",
              message.role === "user"
                ? "ml-6 bg-muted text-foreground"
                : "mr-4 border border-primary/20 bg-accent/40 text-foreground",
            )}
            data-testid={
              message.role === "user"
                ? "leanai-assistant-user-message"
                : "leanai-assistant-assistant-message"
            }
          >
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {message.role === "user" ? "You" : "LeanAI"}
            </p>
            <p className="mt-1">{message.content}</p>
          </div>
        ))}

        {sending ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="leanai-assistant-sending"
          >
            Asking LeanAI…
          </p>
        ) : null}

        {messages.length === 0 && view && !sending ? (
          <div
            className="flex flex-wrap gap-2"
            data-testid="leanai-assistant-starters"
          >
            {view.starterPrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                size="sm"
                variant="outline"
                disabled={!conversationAvailable}
                onClick={() => sendMessage(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <form
        className="shrink-0 border-t border-border px-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim() || sending || !conversationAvailable) {
            return;
          }
          sendMessage(draft);
          setDraft("");
        }}
      >
        {chatError ? (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {chatError}
          </p>
        ) : null}
        {!conversationAvailable ? (
          <p
            className="mb-2 text-sm text-muted-foreground"
            data-testid="leanai-assistant-ai-unavailable"
          >
            {view?.conversationUnavailableReason ??
              "AI conversation is unavailable. Deterministic setup guidance above still works."}
          </p>
        ) : null}
        <label className="sr-only" htmlFor={inputId}>
          Ask LeanAI
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            id={inputId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              conversationAvailable
                ? "Ask LeanAI about this page"
                : "AI conversation unavailable"
            }
            maxLength={2000}
            disabled={!conversationAvailable || sending}
            data-testid="leanai-assistant-input"
          />
          <Button
            type="submit"
            size="sm"
            disabled={
              !conversationAvailable || sending || draft.trim().length === 0
            }
            data-testid="leanai-assistant-send"
          >
            Send
          </Button>
        </div>
        {messages.at(-1)?.role === "assistant" && view?.recommendation ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => hardNavigate(view.recommendation!.targetRoute)}
          >
            Open recommended setup
          </Button>
        ) : null}
      </form>
    </section>
  );
}
