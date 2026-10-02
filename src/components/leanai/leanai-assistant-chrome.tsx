"use client";

import { Sparkles } from "lucide-react";

import { LeanAiAssistantPanel } from "@/components/leanai/leanai-assistant-panel";
import { useLeanAiAssistant } from "@/components/leanai/leanai-assistant-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function LeanAiAssistantChrome() {
  const { desktopOpen, setDesktopOpen, mobileOpen, setMobileOpen, isDesktop } =
    useLeanAiAssistant();

  if (isDesktop) {
    if (!desktopOpen) {
      return (
        <div
          className="hidden h-full w-12 shrink-0 flex-col items-center border-l border-border bg-sidebar py-3 lg:flex"
          data-testid="leanai-assistant-rail"
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Open LeanAI assistant"
            aria-expanded={false}
            onClick={() => setDesktopOpen(true)}
            data-testid="leanai-assistant-open"
          >
            <Sparkles className="size-4" />
          </Button>
        </div>
      );
    }

    return (
      <aside
        className="hidden h-full w-[min(100%,24rem)] shrink-0 flex-col border-l border-border lg:flex"
        data-testid="leanai-assistant-desktop"
      >
        <LeanAiAssistantPanel
          onClose={() => setDesktopOpen(false)}
          closeLabel="Collapse LeanAI assistant"
        />
      </aside>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="icon"
        className="fixed right-4 bottom-4 z-40 shadow-lg lg:hidden"
        aria-label="Open LeanAI assistant"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        data-testid="leanai-assistant-open"
      >
        <Sparkles className="size-4" />
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          className="h-dvh max-h-dvh w-full max-w-[28rem] gap-0 bg-background p-0 [&>button[aria-label='Close']]:hidden"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">LeanAI assistant</SheetTitle>
          <LeanAiAssistantPanel
            onClose={() => setMobileOpen(false)}
            closeLabel="Close LeanAI assistant"
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
