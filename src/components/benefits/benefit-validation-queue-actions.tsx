"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { validateBenefitRealisationEntry } from "@/app/(platform)/platform/benefits/actions";
import { Button } from "@/components/ui/button";

type BenefitValidationActionsProps = {
  entryId: string;
  benefitId: string;
};

export function BenefitValidationActions({
  entryId,
  benefitId,
}: BenefitValidationActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleValidate() {
    setLoading(true);
    const result = await validateBenefitRealisationEntry(entryId, benefitId);
    setMessage(result.error ?? "Validated as actual");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => handleValidate()} disabled={loading}>
        Validate actual
      </Button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </div>
  );
}
