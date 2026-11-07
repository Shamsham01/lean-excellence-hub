"use client";

import { useEffect, useId, useState } from "react";

import { Paperclip, Send } from "lucide-react";

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
  const detectedEnterSends = useFinePointerEnterSends();
  const sendOnEnter = enterSends ?? detectedEnterSends;
  const hint = sendOnEnter
    ? "Enter sends. Ctrl+Enter, Shift+Enter, or Command+Enter adds a line."
    : "Enter adds a line. Send asks LeanAI.";

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
          className="min-h-10 flex-1 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"
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
              const start = target.selectionStart ?? target.value.length;
              const end = target.selectionEnd ?? start;
              const next =
                `${target.value.slice(0, start)}\n${target.value.slice(end)}`.slice(
                  0,
                  LEANAI_COMPOSER_MAX_LENGTH,
                );
              onChange(next);
              const caret = Math.min(start + 1, next.length);
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
          className="size-9 shrink-0 rounded-full p-0"
          data-testid="leanai-assistant-send"
          aria-label="Send message"
        >
          <Send className="size-4" aria-hidden />
        </Button>
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </form>
  );
}
