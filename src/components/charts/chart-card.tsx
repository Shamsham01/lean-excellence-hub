import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  children,
  className,
  testId,
  headerAction,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  testId?: string;
  headerAction?: ReactNode;
}) {
  return (
    <Card className={cn("overflow-hidden", className)} data-testid={testId}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription className="mt-1">{description}</CardDescription>
          ) : null}
        </div>
        {headerAction}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}
