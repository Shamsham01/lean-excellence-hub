"use client";

import { useEffect } from "react";

import { useFormDialogGuardReporter } from "@/components/ui/use-form-dialog-guard";

export function useReportFormDialogPending(pending: boolean) {
  const reporter = useFormDialogGuardReporter();
  useEffect(() => {
    reporter?.setPending(pending);
  }, [pending, reporter]);
}
