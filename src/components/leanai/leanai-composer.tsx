"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const LEANAI_COMPOSER_MAX_LENGTH = 2000;

export type ComposerEnterAction = "send" | "newline" | "ignore";

export function composerEnterAction(
  event: {
    key: string;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    isComposing?: boolean;
    keyCode?: number;
  },
  enterSends: boolean,
): ComposerEnterAction {
  if (event.key !== "Enter") return "ignore";
  if (event.isComposing || event.keyCode === 229) return "ignore";
  if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
    return "newline";
  }
  return enterSends ? "send" : "newline";
}

function useFinePointerEnterSends() {
  const [enterSends, setEnterSends] = useState(true);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setEnterSends(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return enterSends;
}

export function LeanAiComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  sending,
  enterSends,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  sending: boolean;
  enterSends?: boolean;
}) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const detectedEnterSends = useFinePointerEnterSends();
  const sendOnEnter = enterSends ?? detectedEnterSends;
  const hint = sendOnEnter
    ? "Enter sends. Ctrl+Enter, Shift+Enter, or Command+Enter adds a line."
    : "Enter adds a line. Send asks LeanAI.";

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || window.CSS?.supports?.("field-sizing", "content")) return;

    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [value]);

  return (
    <form
      className="flex min-w-0 flex-col gap-2"
      data-enter-sends={sendOnEnter ? "true" : "false"}
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || sending || value.trim().length === 0) return;
        onSubmit();
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        Ask LeanAI
      </label>
      <div
        className={cn(
          "flex min-w-0 items-end gap-2 rounded-2xl border border-border/60 bg-card p-2 shadow-[var(--shadow-theme-xs)]",
          (disabled || sending) && "opacity-80",
        )}
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="size-9 shrink-0 rounded-full"
          disabled={disabled || sending}
          aria-label="Attach context"
          title="Attachments follow existing LeanAI workflows"
        >
          <Paperclip className="size-4" aria-hidden />
        </Button>
        <Textarea
          ref={inputRef}
          id={inputId}
          rows={1}
          value={value}
          maxLength={LEANAI_COMPOSER_MAX_LENGTH}
          disabled={disabled || sending}
          placeholder={
            disabled
              ? "AI conversation unavailable"
              : "Ask LeanAI about this page"
          }
          aria-describedby={hintId}
          data-testid="leanai-assistant-input"
          className="[field-sizing:content] max-h-32 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-1 py-2 shadow-none"
          onChange={(event) =>
            onChange(event.target.value.slice(0, LEANAI_COMPOSER_MAX_LENGTH))
          }
          onKeyDown={(event) => {
            const action = composerEnterAction(
              {
                key: event.key,
                shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                altKey: event.altKey,
                isComposing: event.nativeEvent.isComposing,
                keyCode: event.nativeEvent.keyCode,
              },
              sendOnEnter,
            );
            if (
              action === "newline" &&
              (event.ctrlKey || event.metaKey || event.altKey)
            ) {
              event.preventDefault();
              const target = event.currentTarget;
              const { selectionStart: start, selectionEnd: end } = target;
              if (
                target.value.length - (end - start) >=
                LEANAI_COMPOSER_MAX_LENGTH
              ) {
                return;
              }
              const next = `${target.value.slice(0, start)}\n${target.value.slice(end)}`;
              onChange(next);
              const caret = start + 1;
              requestAnimationFrame(() => {
                target.setSelectionRange(caret, caret);
              });
              return;
            }
            if (action !== "send") return;
            event.preventDefault();
            const form = event.currentTarget.form;
            if (!form) return;
            if (typeof form.requestSubmit === "function") {
              form.requestSubmit();
              return;
            }
            form.dispatchEvent(
              new Event("submit", { bubbles: true, cancelable: true }),
            );
          }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={disabled || sending || value.trim().length === 0}
          className="shrink-0 rounded-full"
          data-testid="leanai-assistant-send"
        >
          Send
        </Button>
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </form>
  );
}
