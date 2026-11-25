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
  prepare?: () => Promise<GembaActionLinkContext | null>;
  disabled?: boolean;
  onActionCreated?: () => void;
};

export function GembaAuditRaiseAction({
  linkContext,
  actionCount,
  prepare,
  disabled = false,
  onActionCreated,
}: GembaAuditRaiseActionProps) {
  const [createOpen, setCreateOpen] = useState(false);

  const [prepared, setPrepared] = useState<GembaActionLinkContext | null>(null);
  const [preparing, setPreparing] = useState(false);

  function handleActionPersisted() {
    onActionCreated?.();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled || preparing}
          data-testid="gemba-raise-action"
          onClick={async () => {
            if (!prepare) {
              setCreateOpen(true);
              return;
            }
            setPreparing(true);
            try {
              const context = await prepare();
              if (context) {
                setPrepared(context);
                setCreateOpen(true);
              }
            } finally {
              setPreparing(false);
            }
          }}
        >
          Create action
        </Button>
        {actionCount > 0 ? (
          <Badge
            variant="secondary"
            data-testid="gemba-observation-action-count"
          >
            {actionCount} action{actionCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>
      <ActionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        gembaLinkContext={prepared ?? linkContext}
        onActionPersisted={handleActionPersisted}
      />
    </>
  );
}
