import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AuthPageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md min-w-0 flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12",
        className,
      )}
    >
      {children}
    </div>
  );
}
