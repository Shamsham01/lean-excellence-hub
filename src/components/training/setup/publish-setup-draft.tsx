"use client";

import { useTransition } from "react";

import { publishTrainingSetupBundle } from "@/app/(platform)/platform/training/setup/actions";
import { Button } from "@/components/ui/button";

export function PublishTrainingSetupDraft({ bundleId }: { bundleId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData();
        data.set("bundleId", bundleId);
        startTransition(() => {
          void publishTrainingSetupBundle(data);
        });
      }}
    >
      <Button
        type="submit"
        disabled={pending}
        data-testid="training-setup-publish"
      >
        {pending ? "Publishing…" : "Publish draft"}
      </Button>
    </form>
  );
}
