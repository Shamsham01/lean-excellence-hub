"use client";

import type { ReactNode } from "react";

import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { usePlanModuleWriteAllowed } from "@/modules/billing/module-write-context";

export function ModuleWriteAppLink({
  href,
  children,
  testId,
  size = "sm",
  variant = "default",
}: {
  href: string;
  children: ReactNode;
  testId?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
}) {
  const writeAllowed = usePlanModuleWriteAllowed();
  if (!writeAllowed) {
    return (
      <Button
        size={size}
        variant={variant}
        disabled
        data-testid={testId}
        title="Upgrade billing to create new records in this module"
      >
        {children}
      </Button>
    );
  }
  return (
    <Button size={size} variant={variant} asChild>
      <AppLink href={href} data-testid={testId}>
        {children}
      </AppLink>
    </Button>
  );
}
