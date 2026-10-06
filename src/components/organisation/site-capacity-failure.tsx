import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { SITE_CAPACITY_EXHAUSTED } from "@/modules/billing/site-capacity";

export function SiteCapacityFailure({
  message,
  errorCode,
  canManageBilling,
}: {
  message: string;
  errorCode?: string;
  canManageBilling?: boolean;
}) {
  const exhausted = errorCode === SITE_CAPACITY_EXHAUSTED;

  return (
    <div
      className="flex flex-col gap-2"
      role="alert"
      data-testid="site-capacity-error"
    >
      <p className="text-sm text-foreground">{message}</p>
      {exhausted && canManageBilling ? (
        <Button variant="outline" size="sm" className="self-start" asChild>
          <AppLink
            href="/platform/settings/billing"
            data-testid="site-capacity-open-billing"
          >
            Open Billing
          </AppLink>
        </Button>
      ) : null}
    </div>
  );
}
