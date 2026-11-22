"use client";

import { Copy, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LeanAiMessageActions({
  content,
  onRegenerate,
  className,
}: {
  content: string;
  onRegenerate?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<"up" | "down" | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-0.5", className)}
      data-testid="leanai-message-actions"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        onClick={() => void handleCopy()}
        aria-label="Copy message"
      >
        <Copy className="size-3.5" aria-hidden />
        {copied ? "Copied" : null}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        aria-label="Helpful response"
        aria-pressed={reaction === "up"}
        onClick={() => setReaction(reaction === "up" ? null : "up")}
      >
        <ThumbsUp className="size-3.5" aria-hidden />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        aria-label="Unhelpful response"
        aria-pressed={reaction === "down"}
        onClick={() => setReaction(reaction === "down" ? null : "down")}
      >
        <ThumbsDown className="size-3.5" aria-hidden />
      </Button>
      {onRegenerate ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          aria-label="Regenerate response"
          onClick={onRegenerate}
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
