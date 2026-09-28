"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { returnAssessmentForCorrection } from "@/app/(platform)/platform/maturity/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReturnForCorrectionForm({
  assessmentId,
}: {
  assessmentId: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex max-w-lg flex-col gap-2"
      data-testid="return-for-correction-form"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await returnAssessmentForCorrection(
            assessmentId,
            reason,
          );
          if (result.error) {
            setError(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      <Label htmlFor="return-reason">Return for correction</Label>
      <Textarea
        id="return-reason"
        required
        rows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Explain what must be corrected before resubmission."
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        disabled={pending || !reason.trim()}
        data-testid="return-for-correction"
      >
        {pending ? "Returning…" : "Return for correction"}
      </Button>
    </form>
  );
}
