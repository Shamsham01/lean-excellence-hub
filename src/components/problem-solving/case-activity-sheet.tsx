"use client";

import {
  ResourceComments,
  type CommentRow,
} from "@/components/comments/resource-comments";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type CaseActivitySheetProps = {
  caseId: string;
  comments: CommentRow[];
};

export function CaseActivitySheet({
  caseId,
  comments,
}: CaseActivitySheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="pps-activity-trigger"
        >
          Activity
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(100%,28rem)] bg-card">
        <SheetHeader>
          <SheetTitle>Activity & comments</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground">
          Clarifications and team notes for this case. No session required.
        </p>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <ResourceComments resourceId={caseId} comments={comments} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
