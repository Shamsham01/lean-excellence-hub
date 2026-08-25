import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("bg-surface", className)}>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="typography-metric-label">{label}</span>
        <span className="typography-metric-value">{value}</span>
        {hint ? <span className="typography-metadata">{hint}</span> : null}
      </CardContent>
    </Card>
  );
}
