"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { instantiateMaturityQuickStartTemplate } from "@/app/(platform)/platform/maturity/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UseQuickStartTemplateButton({
  templateKey,
  className,
}: {
  templateKey: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUseTemplate() {
    if (pending) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await instantiateMaturityQuickStartTemplate(templateKey);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.modelId) {
        router.push(`/platform/maturity/models/${result.modelId}?step=review`);
      }
    });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        type="button"
        onClick={handleUseTemplate}
        disabled={pending}
        aria-busy={pending}
        data-testid="use-quick-start-template"
      >
        {pending ? "Creating draft…" : "Use this template"}
      </Button>
      {error ? (
        <p
          role="alert"
          className="text-sm text-destructive"
          data-testid="use-quick-start-template-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
