import { ProfileAccessGrants } from "@/components/profile/profile-access-grants";
import type { ProfileAccessGrant } from "@/components/profile/profile-access-grants";
import { AppLink } from "@/components/ui/app-link";

export type ProfileOrganisationMembershipView =
  | {
      status: "ready";
      organisationDisplayName: string | null;
      jobFunctionName: string | null;
      primaryWorkAreaName: string | null;
      grants: ProfileAccessGrant[];
      canManageOwnAssignment: boolean;
      administrationHref: string | null;
    }
  | { status: "error" }
  | { status: "unavailable" };

export function ProfileOrganisationMembership({
  view,
}: {
  view: ProfileOrganisationMembershipView;
}) {
  if (view.status === "error") {
    return (
      <p
        className="text-sm text-destructive"
        role="alert"
        data-testid="profile-membership-load-error"
      >
        Your job function, work area and access grants could not be loaded. This
        is not the same as having no assignment.
      </p>
    );
  }

  if (view.status === "unavailable") {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        No active organisation membership is selected.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-muted-foreground">Name in this organisation</dt>
          <dd
            className="break-words"
            data-testid="profile-organisation-display-name"
          >
            {view.organisationDisplayName ??
              "No organisation name is recorded yet."}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Job function</dt>
          <dd className="break-words" data-testid="profile-job-function">
            {view.jobFunctionName ?? "Not assigned"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Primary work area</dt>
          <dd className="break-words" data-testid="profile-primary-work-area">
            {view.primaryWorkAreaName ?? "Not assigned"}
          </dd>
        </div>
        <ProfileAccessGrants grants={view.grants} />
      </dl>
      <p className="text-muted-foreground">
        Job function describes the work you do. It does not grant application
        permissions. Work area and application access are managed by your
        organisation administrator.
        {view.canManageOwnAssignment && view.administrationHref ? (
          <>
            {" "}
            As an administrator, you can update your own organisation assignment
            from{" "}
            <AppLink
              href={view.administrationHref}
              className="underline"
              data-testid="profile-admin-link"
            >
              your administration profile
            </AppLink>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}
