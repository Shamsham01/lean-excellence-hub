"use client";

import { useState } from "react";

import {
  ActionCreateDialog,
  type GembaActionLinkContext,
} from "@/components/actions/action-create-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type GembaAuditRaiseActionProps = {
  linkContext: GembaActionLinkContext;
  actionCount: number;
  disabled?: boolean;
  onActionCreated?: () => void;
};

export function GembaAuditRaiseAction({
  linkContext,
  actionCount,
  disabled = false,
  onActionCreated,
}: GembaAuditRaiseActionProps) {
  const [createOpen, setCreateOpen] = useState(false);

  function handleActionPersisted(_actionId: string) {
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
          data-testid="gemba-raise-action"
          onClick={() => setCreateOpen(true)}
        >
          Create action
        </Button>
        {actionCount > 0 ? (
          <Badge variant="secondary" data-testid="gemba-observation-action-count">
            {actionCount} action{actionCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>
      <ActionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        gembaLinkContext={linkContext}
        onActionPersisted={handleActionPersisted}
      />
    </>
  );
}