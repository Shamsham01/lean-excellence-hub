"use client";

import { useState, useTransition } from "react";

import { publishSkillsSetupBundle } from "@/app/(platform)/platform/skills/setup/actions";
import { Button } from "@/components/ui/button";

export function PublishSetupDraft({ bundleId }: { bundleId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) {
          return;
        }
        const data = new FormData();
        data.set("bundleId", bundleId);
        startTransition(async () => {
          const result = await publishSkillsSetupBundle(data);
          if (result && "error" in result && result.error) {
            setError(result.error);
          }
        });
      }}
    >
      <Button
        type="submit"
        className="w-full sm:w-auto"
        data-testid="skills-publish"
        disabled={pending}
      >
        Publish requirements
      </Button>
      {error ? (
        <p className="mt-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
