import type { ReactNode } from "react";

import { InlineAlert, type InlineAlertTone } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function AuthStatus({
  tone,
  children,
  testId,
  className,
}: {
  tone: "danger" | "info";
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  const mapped: InlineAlertTone = tone === "danger" ? "error" : "info";
  return (
    <InlineAlert
      tone={mapped}
      {...(testId ? { testId } : {})}
      className={cn("[&_a]:text-primary", className)}
    >
      {children}
    </InlineAlert>
  );
}
