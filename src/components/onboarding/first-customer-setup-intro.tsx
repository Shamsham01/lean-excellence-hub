import { AppLink } from "@/components/ui/app-link";
import {
  MULTI_SITE_INTENT_LABELS,
  resolveMultiSiteIntent,
} from "@/modules/organisation-rollout/multi-site-intent";

export function FirstCustomerSetupIntro({
  organisationName,
  firstSiteName,
  multiSiteIntent,
  canOpenRollout,
}: {
  organisationName: string;
  firstSiteName: string | null;
  multiSiteIntent: string | null;
  canOpenRollout: boolean;
}) {
  const intent = resolveMultiSiteIntent(multiSiteIntent);

  return (
    <section
      className="flex flex-col gap-4 border-b border-border pb-6"
      data-testid="first-customer-setup-intro"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Organisation
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {organisationName}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            First site
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {firstSiteName ?? "Not created yet"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Wider organisation
          </p>
          <p className="mt-1 text-sm text-foreground">
            {MULTI_SITE_INTENT_LABELS[intent]}
          </p>
        </div>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Complete the core steps so this first site can run. Choose which modules
        form your initial operating system — you do not need to configure
        everything before launch.
      </p>
      {canOpenRollout ? (
        <p className="text-sm">
          <AppLink
            href="/platform/settings/organisation/rollout"
            className="font-medium text-foreground underline underline-offset-2"
            data-testid="setup-open-rollout"
          >
            Rollout & Governance
          </AppLink>
          <span className="text-muted-foreground">
            {" "}
            is where you add another site after capacity is available.
          </span>
        </p>
      ) : null}
    </section>
  );
}
