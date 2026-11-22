import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  planCapabilityMessage,
  type PlanCapabilityKey,
} from "@/modules/billing/plan-capabilities";

export function PlanUpgradePrompt({
  capability,
  testId = "plan-upgrade-prompt",
}: {
  capability: PlanCapabilityKey;
  testId?: string;
}) {
  const copy = planCapabilityMessage(capability);

  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        <p>{copy.description}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <AppLink
              href="/platform/settings/billing"
              data-testid={`${testId}-billing`}
            >
              View billing
            </AppLink>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <AppLink href="/pricing" data-testid={`${testId}-pricing`}>
              Compare plans
            </AppLink>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
