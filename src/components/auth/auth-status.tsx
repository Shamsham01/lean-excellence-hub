import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AuthStatus({
  tone,
  children,
  testId,
}: {
  tone: "danger" | "info";
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "danger"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
      data-testid={testId}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
