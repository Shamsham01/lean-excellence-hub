"use client";

import { useTransition } from "react";

import { discardTrainingSetupBundle } from "@/app/(platform)/platform/training/setup/actions";
import { Button } from "@/components/ui/button";

export function DiscardTrainingSetupDraft({ bundleId }: { bundleId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData();
        data.set("bundleId", bundleId);
        startTransition(() => {
          void discardTrainingSetupBundle(data);
        });
      }}
    >
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        data-testid="training-setup-discard"
      >
        {pending ? "Discarding…" : "Discard draft"}
      </Button>
    </form>
  );
}
