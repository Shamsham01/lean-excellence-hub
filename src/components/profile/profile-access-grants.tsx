import { formatAccessScopeDisplay } from "@/lib/access-scope";

export type ProfileAccessGrant = {
  role_display_name: string;
  scope_type: string;
  scope_unit_name?: string | null;
};

export type ProfileAccessGrantsView =
  | { mode: "none" }
  | { mode: "single"; grant: ProfileAccessGrant }
  | { mode: "multiple"; grants: ProfileAccessGrant[] };

export function resolveProfileAccessGrantsView(
  grants: ProfileAccessGrant[],
): ProfileAccessGrantsView {
  if (grants.length === 0) {
    return { mode: "none" };
  }

  if (grants.length === 1) {
    return { mode: "single", grant: grants[0]! };
  }

  return { mode: "multiple", grants };
}

export function ProfileAccessGrants({
  grants,
}: {
  grants: ProfileAccessGrant[];
}) {
  const view = resolveProfileAccessGrantsView(grants);

  if (view.mode === "none") {
    return (
      <div className="sm:col-span-2">
        <dt className="text-muted-foreground" data-testid="your-access-summary">
          Your access
        </dt>
        <dd data-testid="profile-application-access-empty">
          No active access grants
        </dd>
      </div>
    );
  }

  if (view.mode === "single") {
    return (
      <>
        <div>
          <dt
            className="text-muted-foreground"
            data-testid="your-access-summary"
          >
            Your access
          </dt>
          <dd className="break-words" data-testid="profile-application-role">
            {view.grant.role_display_name}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Access scope</dt>
          <dd className="break-words" data-testid="profile-access-scope">
            {formatAccessScopeDisplay(view.grant)}
          </dd>
        </div>
      </>
    );
  }

  return (
    <div className="sm:col-span-2">
      <dt className="text-muted-foreground" data-testid="your-access-summary">
        Your access
      </dt>
      <dd>
        <ul
          className="mt-1 flex flex-col gap-3"
          data-testid="profile-application-access-list"
        >
          {view.grants.map((grant, index) => (
            <li
              key={`${grant.role_display_name}-${grant.scope_type}-${grant.scope_unit_name ?? "org"}-${index}`}
              className="min-w-0 rounded-md border border-border px-3 py-2"
              data-testid="profile-application-access-item"
            >
              <p
                className="font-medium break-words"
                data-testid="profile-application-role"
              >
                {grant.role_display_name}
              </p>
              <p
                className="break-words text-muted-foreground"
                data-testid="profile-access-scope"
              >
                {formatAccessScopeDisplay(grant)}
              </p>
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}
