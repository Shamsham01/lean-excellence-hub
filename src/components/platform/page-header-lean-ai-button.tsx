"use client";

import { Sparkles } from "lucide-react";

import { requestLeanAiAssistantOpen } from "@/modules/leanai-context/assistant/open-request";
import { Button } from "@/components/ui/button";

export function PageHeaderLeanAiButton({
  label = "Ask LeanAI about this page",
}: {
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="size-9 shrink-0 rounded-full p-0"
      aria-label={label}
      title={label}
      data-testid="page-header-ask-leanai"
      onClick={() => requestLeanAiAssistantOpen()}
    >
      <Sparkles className="size-4 text-primary" aria-hidden />
    </Button>
  );
}
