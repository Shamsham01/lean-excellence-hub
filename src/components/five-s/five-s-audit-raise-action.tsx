"use client";

import { useState } from "react";

import {
  ActionCreateDialog,
  type FiveSActionLinkContext,
} from "@/components/actions/action-create-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FiveSAuditRaiseActionProps = {
  linkContext: FiveSActionLinkContext;
  actionCount: number;
  disabled?: boolean;
  onActionCreated?: () => void;
};

export function FiveSAuditRaiseAction({
  linkContext,
  actionCount,
  disabled = false,
  onActionCreated,
}: FiveSAuditRaiseActionProps) {
  const [createOpen, setCreateOpen] = useState(false);

  function handleCreated(_actionId: string) {
    setCreateOpen(false);
    onActionCreated?.();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled}
          data-testid="five-s-raise-action"
          onClick={() => setCreateOpen(true)}
        >
          Raise action
        </Button>
        {actionCount > 0 ? (
          <Badge variant="secondary" data-testid="five-s-question-action-count">
            {actionCount} action{actionCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>
      <ActionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        fiveSLinkContext={linkContext}
        onCreated={handleCreated}
      />
    </>
  );
}
