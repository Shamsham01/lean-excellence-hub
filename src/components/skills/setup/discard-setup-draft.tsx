"use client";

import { useState, useTransition } from "react";

import { discardSkillsSetupBundle } from "@/app/(platform)/platform/skills/setup/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ImpactItem = {
  id?: string;
  kind: string;
  label: string;
  reason?: string;
};

type Impact = {
  removed: ImpactItem[];
  retained: ImpactItem[];
};

export function DiscardSetupDraft({
  bundleId,
  impact,
}: {
  bundleId: string;
  impact: Impact;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full max-w-full whitespace-normal sm:w-auto"
        data-testid="skills-discard-open"
        onClick={() => setOpen(true)}
      >
        Discard setup draft
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(85dvh,40rem)] w-[calc(100%-1.5rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Discard this setup draft?</DialogTitle>
            <DialogDescription>
              Only unused records created by this draft are removed. Reused
              skills, published configuration, assessments, and training links
              stay. This is not an organisation reset.
            </DialogDescription>
          </DialogHeader>
          <div
            className="flex min-w-0 flex-col gap-3 text-sm [overflow-wrap:anywhere]"
            data-testid="skills-discard-preview"
          >
            <div>
              <p className="font-medium">Will remove if still unused</p>
              <ul className="mt-1 flex flex-col gap-1">
                {impact.removed.length === 0 ? (
                  <li>Nothing can be removed.</li>
                ) : (
                  impact.removed.map((item, index) => (
                    <li key={item.id ?? `${item.kind}-${item.label}-${index}`}>
                      {item.label} ({item.kind})
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <p className="font-medium">Will keep</p>
              <ul className="mt-1 flex flex-col gap-1">
                {impact.retained.length === 0 ? (
                  <li>No shared records.</li>
                ) : (
                  impact.retained.map((item, index) => (
                    <li key={item.id ?? `${item.kind}-${item.label}-${index}`}>
                      {item.label}: {item.reason}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
          {error ? (
            <p className="text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) {
                return;
              }
              const data = new FormData();
              data.set("bundleId", bundleId);
              startTransition(async () => {
                const result = await discardSkillsSetupBundle(data);
                if (result && "error" in result && result.error) {
                  setError(result.error);
                }
              });
            }}
          >
            <Button
              type="submit"
              className="w-full max-w-full whitespace-normal sm:w-auto"
              data-testid="skills-discard-confirm"
              disabled={pending}
            >
              Discard unused draft records
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
