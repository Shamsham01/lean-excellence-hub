"use client";

import { AlertTriangle, Sparkles, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  MaturityBuilderDiscoveryQuestion,
  MaturityBuilderTurn,
} from "@/modules/maturity/ai-builder/types";

import type { MaturityBuilderRefineTarget } from "./maturity-builder-proposal";

export const MATURITY_BUILDER_STARTERS = [
  "Assess how consistently our sites apply our own operating standards",
  "Translate our existing operational excellence assessment into LEH",
  "Build a maturity framework for 5S and visual management in production areas",
] as const;

export function MaturityBuilderTranscript({
  turns,
  pending,
}: {
  turns: MaturityBuilderTurn[];
  pending: boolean;
}) {
  const endRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length, pending]);

  return (
    <ol
      className="flex flex-col gap-3"
      aria-label="Conversation with LeanAI"
      data-testid="maturity-builder-transcript"
    >
      {turns.map((turn) =>
        turn.role === "user" ? (
          <li key={turn.id} className="flex justify-end">
            <p className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm break-words whitespace-pre-wrap text-foreground">
              <span className="sr-only">You: </span>
              {turn.text}
            </p>
          </li>
        ) : (
          <li
            key={turn.id}
            className="flex flex-col gap-1"
            data-testid="maturity-builder-assistant-turn"
          >
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3 text-primary" aria-hidden="true" />
              LeanAI
              {turn.proposalRevision ? (
                <span className="text-muted-foreground">
                  · proposal revision {turn.proposalRevision}
                </span>
              ) : null}
            </p>
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
              {turn.message}
            </p>
            {turn.responseStatus === "invalid_response" ||
            turn.proposalStatus === "invalid" ? (
              <p className="flex items-start gap-1.5 text-xs text-warning-foreground">
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                This reply could not be used as a proposal. Nothing changed.
              </p>
            ) : null}
          </li>
        ),
      )}
      {pending ? (
        <li
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-busy="true"
          data-testid="maturity-builder-pending"
        >
          <span className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
          LeanAI is working on it…
        </li>
      ) : null}
      <li ref={endRef} aria-hidden="true" className="h-px" />
    </ol>
  );
}

export function MaturityBuilderComposer({
  value,
  onChange,
  onSubmit,
  onPropose,
  showPropose,
  pending,
  disabled,
  refineTarget,
  onCancelRefine,
  questions,
  maxChars,
  textareaRef,
  isEmpty,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onPropose: () => void;
  showPropose: boolean;
  pending: boolean;
  disabled: boolean;
  refineTarget: MaturityBuilderRefineTarget | null;
  onCancelRefine: () => void;
  questions: MaturityBuilderDiscoveryQuestion[];
  maxChars: number;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  isEmpty: boolean;
}) {
  const inputId = useId();
  const hintId = useId();
  const remaining = maxChars - value.length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit();
    }
    if (event.key === "Escape" && refineTarget) {
      event.preventDefault();
      onCancelRefine();
    }
  }

  function applySuggestion(answer: string) {
    const next = value.trim() ? `${value.trim()} ${answer}` : answer;
    onChange(next.slice(0, maxChars));
    textareaRef.current?.focus();
  }

  const label = refineTarget
    ? `Describe the change to ${refineTarget.label}`
    : isEmpty
      ? "What should your framework assess?"
      : "Reply to LeanAI";

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={handleSubmit}
      data-testid="maturity-builder-composer"
    >
      {questions.length > 0 && !refineTarget ? (
        <div
          className="flex flex-col gap-2"
          data-testid="maturity-builder-questions"
        >
          {questions.map((question) => (
            <div key={question.question} className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">
                {question.question}
              </p>
              {question.suggestedAnswers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {question.suggestedAnswers.map((answer) => (
                    <Button
                      key={answer}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => applySuggestion(answer)}
                    >
                      {answer}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {refineTarget ? (
        <div
          className="flex items-center justify-between gap-2 rounded-md border border-information/30 bg-information/10 px-3 py-2 text-sm"
          data-testid="maturity-builder-refine-target"
        >
          <span className="min-w-0 break-words text-foreground">
            Refining <span className="font-medium">{refineTarget.label}</span>
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-9 shrink-0"
            onClick={onCancelRefine}
            aria-label="Cancel refinement"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
        <Textarea
          id={inputId}
          ref={textareaRef}
          value={value}
          maxLength={maxChars}
          rows={3}
          disabled={disabled}
          aria-describedby={hintId}
          placeholder={
            refineTarget
              ? "For example: rename it to Safety Leadership"
              : isEmpty
                ? "For example: how consistently our sites apply our operating standards"
                : "Type your answer"
          }
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="maturity-builder-input"
        />
        <p
          id={hintId}
          className={cn(
            "flex justify-between gap-2 text-xs text-muted-foreground",
            remaining < 100 && "text-warning-foreground",
          )}
        >
          <span className="hidden sm:inline">Ctrl or ⌘ + Enter to send</span>
          <span className="tabular-nums">{remaining} characters left</span>
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="submit"
          disabled={disabled || value.trim().length === 0}
          aria-busy={pending}
          data-testid="maturity-builder-send"
        >
          {pending ? "Sending…" : refineTarget ? "Refine proposal" : "Send"}
        </Button>
        {showPropose && !refineTarget ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={onPropose}
            data-testid="maturity-builder-propose"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Draft a proposal now
          </Button>
        ) : null}
      </div>
    </form>
  );
}
