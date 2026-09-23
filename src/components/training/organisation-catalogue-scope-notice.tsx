import type { ActiveSiteContext } from "@/modules/organisation/site-context";

type OrganisationCatalogueScopeNoticeProps = {
  context: ActiveSiteContext;
  className?: string;
};

export function OrganisationCatalogueScopeNotice({
  context,
  className,
}: OrganisationCatalogueScopeNoticeProps) {
  if (context.mode !== "site" || !context.activeSiteId) {
    return null;
  }

  const activeSite = context.sites.find(
    (site) => site.id === context.activeSiteId,
  );

  return (
    <p
      className={
        className ??
        "rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground"
      }
      data-testid="training-catalogue-scope-notice"
    >
      Training courses apply organisation-wide. The active site (
      {activeSite?.name ?? "selected site"}) does not filter this catalogue.
    </p>
  );
}
