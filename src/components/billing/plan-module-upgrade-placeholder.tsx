import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  moduleUpgradeDescription,
  moduleUpgradeTitle,
  type PlanModuleCode,
} from "@/modules/billing/module-entitlements";

export function PlanModuleUpgradePlaceholder({
  module,
}: {
  module: PlanModuleCode;
}) {
  return (
    <Card data-testid={`plan-module-upgrade-${module}`}>
      <CardHeader>
        <CardTitle className="text-base">
          {moduleUpgradeTitle(module)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
        <p>{moduleUpgradeDescription(module)}</p>
        <p>
          You can still open historical records you already have access to. New
          work in this module needs Professional (or your current plan&apos;s
          module set).
        </p>
        <Button size="sm" className="self-start" asChild>
          <AppLink
            href={`/platform/settings/billing?module=${encodeURIComponent(module)}`}
            data-testid="plan-module-upgrade-billing-link"
          >
            View billing and upgrade options
          </AppLink>
        </Button>
      </CardContent>
    </Card>
  );
}
