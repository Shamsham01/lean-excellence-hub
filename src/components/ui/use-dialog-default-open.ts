"use client";

import { useEffect, useState } from "react";

import { usePlanModuleWriteAllowed } from "@/modules/billing/module-write-context";

/** Opens on mount only when `defaultOpen` and plan module writes are allowed. */
export function useDialogDefaultOpen(defaultOpen = false) {
  const writeAllowed = usePlanModuleWriteAllowed();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (defaultOpen && writeAllowed) {
      setOpen(true);
    }
  }, [defaultOpen, writeAllowed]);

  return [open, setOpen] as const;
}
