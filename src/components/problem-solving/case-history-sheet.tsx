"use client";

import { HistoryPanel } from "@/components/problem-solving/history-panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { PinnedMethodVersionContext } from "@/lib/problem-solving/load-case-workspace-data";
import type { ProblemSolvingCaseDetail } from "@/lib/problem-solving/types";

type CaseHistorySheetProps = {
  detail: ProblemSolvingCaseDetail;
  membershipNameById: Record<string, string>;
  pinnedMethodVersion: PinnedMethodVersionContext | null;
};

export function CaseHistorySheet({
  detail,
  membershipNameById,
  pinnedMethodVersion,
}: CaseHistorySheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="pps-history-trigger"
        >
          History
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100%,28rem)] bg-card">
        <SheetHeader>
          <SheetTitle>Case history</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2">
          {pinnedMethodVersion ? (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">Method version</p>
              <p className="text-muted-foreground">
                {pinnedMethodVersion.methodName} · v
                {pinnedMethodVersion.versionNumber} (
                {pinnedMethodVersion.versionStatus})
              </p>
            </div>
          ) : null}
          <HistoryPanel
            detail={detail}
            membershipNameById={membershipNameById}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
