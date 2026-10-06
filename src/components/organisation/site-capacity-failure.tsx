import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { ADD_SITE_CAPACITY_HREF } from "@/modules/billing/site-capacity-increase";
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
            href={ADD_SITE_CAPACITY_HREF}
            data-testid="site-capacity-open-billing"
          >
            Add site capacity
          </AppLink>
        </Button>
      ) : null}
    </div>
  );
}
