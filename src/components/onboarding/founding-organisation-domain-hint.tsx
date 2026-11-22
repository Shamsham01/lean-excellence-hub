export function FoundingOrganisationDomainHint() {
  return (
    <div
      className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-foreground"
      role="status"
      data-testid="founding-organisation-domain-hint"
    >
      <p className="font-medium text-foreground">
        Your email domain may already be in use
      </p>
      <p className="mt-1 text-muted-foreground">
        If your company already uses Lean Excellence Hub, ask your administrator
        for an invitation before creating a separate organisation. You can still
        continue below when you are setting up a genuinely new group.
      </p>
    </div>
  );
}
