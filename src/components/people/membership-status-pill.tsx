import { Badge } from "@/components/ui/badge";
import { membershipStatusPresentation } from "@/lib/people/membership-status";
import { cn } from "@/lib/utils";

export function MembershipStatusPill({ status }: { status: string }) {
  const presentation = membershipStatusPresentation(status);
  return (
    <Badge
      variant={presentation.variant}
      className={cn("whitespace-nowrap", presentation.className)}
      data-testid={`membership-status-${status}`}
    >
      {presentation.label}
    </Badge>
  );
}
