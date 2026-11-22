"use client";

import { useState } from "react";

import { usePlanModuleWriteAllowed } from "@/modules/billing/module-write-context";

/** Initial open only when `defaultOpen` and plan module writes are allowed. */
export function useDialogDefaultOpen(defaultOpen = false) {
  const writeAllowed = usePlanModuleWriteAllowed();
  const [open, setOpen] = useState(() => defaultOpen && writeAllowed);

  return [open, setOpen] as const;
}
