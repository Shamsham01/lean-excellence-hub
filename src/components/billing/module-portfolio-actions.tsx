"use client";

import type { ReactNode } from "react";

import { ModuleWriteAppLink } from "@/components/billing/module-write-app-link";

export function ModulePortfolioNewLink({
  href,
  testId,
  children,
}: {
  href: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <ModuleWriteAppLink href={href} testId={testId}>
      {children}
    </ModuleWriteAppLink>
  );
}
