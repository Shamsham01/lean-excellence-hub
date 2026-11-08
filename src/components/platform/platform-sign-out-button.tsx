"use client";

import { LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PlatformSignOutButton({
  className,
  children,
  showIcon = true,
  testId = "platform-chrome-sign-out",
}: {
  className?: string;
  children?: ReactNode;
  showIcon?: boolean;
  testId?: string;
}) {
  return (
    <form action="/auth/signout" method="post" className="contents">
      <button type="submit" className={cn(className)} data-testid={testId}>
        {children ? (
          children
        ) : (
          <>
            {showIcon ? (
              <LogOut className="size-3.5 shrink-0" aria-hidden />
            ) : null}
            Sign out
          </>
        )}
      </button>
    </form>
  );
}
