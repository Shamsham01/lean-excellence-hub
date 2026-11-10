import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function KpiStatGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
