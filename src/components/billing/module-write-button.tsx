"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { usePlanModuleWriteAllowed } from "@/modules/billing/module-write-context";

/** Primary mutation control — disabled when plan blocks new writes in this module. */
export function ModuleWriteButton({
  children,
  disabled,
  ...props
}: ComponentProps<typeof Button>) {
  const writeAllowed = usePlanModuleWriteAllowed();
  return (
    <Button {...props} disabled={disabled || !writeAllowed}>
      {children}
    </Button>
  );
}
