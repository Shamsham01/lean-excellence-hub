"use client";

import { AlertTriangle, Check, Sparkles, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
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

import {
  composeGuidedAnswerMessage,
  orderedGuidedSelections,
} from "./compose-guided-answers";
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
  selections,
  onToggleAnswer,
  maxChars,
  textareaRef,
  isEmpty,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  onPropose: (message: string) => void;
  showPropose: boolean;
  pending: boolean;
  disabled: boolean;
  refineTarget: MaturityBuilderRefineTarget | null;
  onCancelRefine: () => void;
  questions: MaturityBuilderDiscoveryQuestion[];
  selections: Readonly<Record<string, string>>;
  onToggleAnswer: (question: string, answer: string) => void;
  maxChars: number;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  isEmpty: boolean;
}) {
  const inputId = useId();
  const hintId = useId();
  const lengthErrorId = useId();
  const guiding = questions.length > 0 && !refineTarget;
  const selectedAnswers = guiding
    ? orderedGuidedSelections(questions, selections)
    : [];
  const outgoing = refineTarget
    ? value.trim()
    : composeGuidedAnswerMessage({
        selections: selectedAnswers,
        notes: value,
      });
  const tooLong = outgoing.length > maxChars;
  const remaining = maxChars - outgoing.length;
  const lengthError = tooLong
    ? `This reply is ${outgoing.length} characters. Keep the full reply within ${maxChars} characters by shortening the additional instructions or clearing a selected answer.`
    : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || tooLong || outgoing.length === 0) {
      return;
    }
    onSubmit(outgoing);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (disabled || tooLong || outgoing.length === 0) {
        return;
      }
      onSubmit(outgoing);
    }
    if (event.key === "Escape" && refineTarget) {
      event.preventDefault();
      onCancelRefine();
    }
  }

  function handlePropose() {
    if (disabled || tooLong) {
      return;
    }
    onPropose(outgoing);
  }

  const label = refineTarget
    ? `Describe the change to ${refineTarget.label}`
    : guiding
      ? "Additional instructions (optional)"
      : isEmpty
        ? "What should your framework assess?"
        : "Reply to LeanAI";

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={handleSubmit}
      data-testid="maturity-builder-composer"
    >
      {guiding ? (
        <div
          className="flex flex-col gap-4 rounded-lg border border-border bg-muted/40 p-3 sm:p-4"
          data-testid="maturity-builder-questions"
        >
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">
              Answer LeanAI
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Choose one option for each question. Select a chosen option again
              to clear it, or write your own answer below.
            </p>
          </div>
          {questions.map((question) => (
            <QuestionChoices
              key={question.question}
              question={question}
              selectedAnswer={
                question.suggestedAnswers.includes(
                  selections[question.question] ?? "",
                )
                  ? selections[question.question]
                  : undefined
              }
              disabled={disabled}
              onToggle={onToggleAnswer}
            />
          ))}
          <p
            className="text-xs font-medium text-muted-foreground"
            data-testid="maturity-builder-selection-summary"
          >
            {selectedAnswers.length} of {questions.length} answered
          </p>
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
          aria-invalid={tooLong || undefined}
          aria-describedby={lengthError ? `${hintId} ${lengthErrorId}` : hintId}
          enterKeyHint="send"
          placeholder={
            refineTarget
              ? "For example: rename it to Safety Leadership"
              : guiding
                ? "Add a clarification, or write your own answer"
                : isEmpty
                  ? "For example: how consistently our sites apply our operating standards"
                  : "Type your answer"
          }
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="maturity-builder-input"
        />
        {lengthError ? (
          <p
            id={lengthErrorId}
            role="alert"
            className="text-xs text-warning-foreground"
            data-testid="maturity-builder-length-error"
          >
            {lengthError}
          </p>
        ) : null}
        <p
          id={hintId}
          className={cn(
            "flex justify-between gap-2 text-xs text-muted-foreground",
            (tooLong || remaining < 100) && "text-warning-foreground",
          )}
        >
          <span className="hidden sm:inline">Ctrl or ⌘ + Enter to send</span>
          <span className="tabular-nums">
            {tooLong
              ? `${outgoing.length - maxChars} over the limit`
              : selectedAnswers.length > 0
                ? `${remaining} left, including selected answers`
                : `${remaining} characters left`}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="submit"
          disabled={disabled || tooLong || outgoing.length === 0}
          aria-busy={pending}
          data-testid="maturity-builder-send"
        >
          {pending
            ? "Sending…"
            : refineTarget
              ? "Refine proposal"
              : guiding
                ? "Send answers"
                : "Send"}
        </Button>
        {showPropose && !refineTarget ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || tooLong}
            onClick={handlePropose}
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

function QuestionChoices({
  question,
  selectedAnswer,
  disabled,
  onToggle,
}: {
  question: MaturityBuilderDiscoveryQuestion;
  selectedAnswer: string | undefined;
  disabled: boolean;
  onToggle: (question: string, answer: string) => void;
}) {
  const hintId = useId();
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const answers = question.suggestedAnswers;
  const selectedIndex = selectedAnswer ? answers.indexOf(selectedAnswer) : -1;
  const [rovingIndex, setRovingIndex] = useState(0);
  const safeRoving =
    answers.length === 0
      ? 0
      : Math.min(Math.max(rovingIndex, 0), answers.length - 1);
  const tabIndex = selectedIndex >= 0 ? selectedIndex : safeRoving;

  function focusOption(index: number) {
    setRovingIndex(index);
    optionRefs.current[index]?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (answers.length === 0) {
      return;
    }
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (index + 1) % answers.length
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (index - 1 + answers.length) % answers.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? answers.length - 1
              : null;
    if (next === null) {
      return;
    }
    event.preventDefault();
    focusOption(next);
  }

  return (
    <fieldset
      className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
      data-testid="maturity-builder-question"
      disabled={disabled}
    >
      <legend className="mb-1 px-0 text-sm font-medium text-pretty text-foreground">
        {question.question}
      </legend>
      {answers.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p id={hintId} className="sr-only">
            Choose one answer. Activate a selected answer again to clear it.
            Arrow keys move between answers.
          </p>
          {answers.map((answer, index) => {
            const selected = answer === selectedAnswer;
            const tabStop = tabIndex === index;
            return (
              <button
                key={`${answer}-${index}`}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                aria-pressed={selected}
                aria-describedby={hintId}
                tabIndex={tabStop ? 0 : -1}
                disabled={disabled}
                onClick={() => onToggle(question.question, answer)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                data-testid="maturity-builder-answer"
                data-question={question.question}
                data-answer={answer}
                data-selected={selected ? "true" : "false"}
                className={cn(
                  "flex min-h-11 w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                  selected
                    ? "border-primary bg-primary/15 font-medium text-foreground ring-1 ring-primary"
                    : "border-border bg-elevated text-foreground hover:border-primary/40 hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 bg-transparent",
                  )}
                  aria-hidden="true"
                >
                  {selected ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 break-words">{answer}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Answer this in your own words below.
        </p>
      )}
    </fieldset>
  );
}
