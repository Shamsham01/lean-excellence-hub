"use client";

import { useState } from "react";

import { ContextualHelpLabel } from "@/components/help/contextual-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUnitPath } from "@/modules/organisation/unit-hierarchy";
import { toCustomerErrorMessage } from "@/modules/people/customer-errors";

type UnitOption = {
  id: string;
  name: string;
  code: string;
  parent_unit_id: string | null;
};

type JobFunctionOption = {
  id: string;
  name: string;
  code: string;
};

type AccessGrant = {
  grant_id: string;
  role_display_name: string;
  role_canonical_name?: string | null;
  module_responsibility_key?: string | null;
  responsibility_kind?: string | null;
  scope_type: string;
  scope_unit_name: string | null;
  scope_unit_path?: string | null;
  status: string;
};

export type MemberAdministrationProfile = {
  membership_id: string;
  display_name: string | null;
  email: string | null;
  username?: string | null;
  notification_email?: string | null;
  auth_login_email?: string | null;
  is_workforce_account?: boolean;
  status: string;
  status_reason?: string | null;
  job_title: string | null;
  primary_organisational_unit: {
    id: string;
    name: string;
    code: string;
  } | null;
  job_function: {
    id: string;
    name: string;
    code: string;
  } | null;
  access_grants: AccessGrant[];
  permissions: {
    can_manage_membership: boolean;
    can_manage_job_functions: boolean;
    can_delegate_access: boolean;
    can_reset_credentials?: boolean;
    is_self: boolean;
  };
};

type MemberAdministrationPanelProps = {
  profile: MemberAdministrationProfile;
  units: UnitOption[];
  jobFunctions: JobFunctionOption[];
  onUpdateDisplayName: (
    displayName: string,
  ) => Promise<{ error?: string; ok?: true }>;
  onAssignJobFunction: (input: {
    jobFunctionId: string;
    organisationalUnitId: string;
  }) => Promise<{ error?: string; ok?: true }>;
  onSetMembershipStatus?: (input: {
    status: "active" | "inactive";
    changeReason?: string;
  }) => Promise<{ error?: string; ok?: true }>;
  onResetCredentials?: () => Promise<
    | {
        ok: true;
        username: string;
        temporaryPassword: string;
      }
    | { error: string }
  >;
};

export function MemberAdministrationPanel({
  profile,
  units,
  jobFunctions,
  onUpdateDisplayName,
  onAssignJobFunction,
  onSetMembershipStatus,
  onResetCredentials,
}: MemberAdministrationPanelProps) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [jobFunctionId, setJobFunctionId] = useState(
    profile.job_function?.id ?? "",
  );
  const [organisationalUnitId, setOrganisationalUnitId] = useState(
    profile.primary_organisational_unit?.id ?? "",
  );
  const [statusReason, setStatusReason] = useState("");
  const [resetCredentials, setResetCredentials] = useState<{
    username: string;
    temporaryPassword: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canEditMembership =
    profile.permissions.can_manage_membership && !profile.permissions.is_self;
  const canAssignJobFunction = profile.permissions.can_manage_job_functions;
  const canManageLifecycle =
    canEditMembership && Boolean(onSetMembershipStatus);
  const canResetCredentials =
    profile.permissions.can_reset_credentials &&
    profile.is_workforce_account &&
    profile.status === "active" &&
    Boolean(onResetCredentials);

  async function handleSaveDisplayName(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const result = await onUpdateDisplayName(displayName.trim());
    setMessage(
      result.error ??
        (result.ok
          ? "Display name updated."
          : "Unable to update display name."),
    );
    setLoading(false);
  }

  async function handleAssignJobFunction(event: React.FormEvent) {
    event.preventDefault();
    if (!jobFunctionId || !organisationalUnitId) {
      setMessage("Select both a job function and a primary organisation unit.");
      return;
    }

    setLoading(true);
    setMessage(null);
    const result = await onAssignJobFunction({
      jobFunctionId,
      organisationalUnitId,
    });
    setMessage(
      result.error ??
        (result.ok
          ? "Organisation assignment updated."
          : "Unable to update organisation assignment."),
    );
    setLoading(false);
  }

  async function handleSetStatus(status: "active" | "inactive") {
    if (!onSetMembershipStatus) {
      return;
    }

    if (status === "inactive" && !statusReason.trim()) {
      setMessage("Enter a reason before deactivating this employee.");
      return;
    }

    setLoading(true);
    setMessage(null);
    const result = await onSetMembershipStatus({
      status,
      ...(status === "inactive" ? { changeReason: statusReason.trim() } : {}),
    });
    setMessage(
      result.error ??
        (result.ok
          ? status === "inactive"
            ? "Employee deactivated. Active organisation access and sessions have ended. Historical records are preserved."
            : "Employee reactivated."
          : "Unable to update membership status."),
    );
    if (result.ok && status === "inactive") {
      setStatusReason("");
    }
    setLoading(false);
  }

  async function handleResetCredentials() {
    if (!onResetCredentials) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setResetCredentials(null);
    const result = await onResetCredentials();
    if ("error" in result) {
      setMessage(result.error);
    } else {
      setResetCredentials({
        username: result.username,
        temporaryPassword: result.temporaryPassword,
      });
      setMessage(
        "Temporary credentials reissued. Share them securely — they are shown once.",
      );
    }
    setLoading(false);
  }

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="member-administration-panel"
    >
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Identity</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Display name</dt>
            <dd>{profile.display_name ?? "Not set"}</dd>
          </div>
          {profile.is_workforce_account ? (
            <>
              <div>
                <dt className="text-muted-foreground">Username</dt>
                <dd data-testid="member-username">
                  {profile.username ?? "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Notification email</dt>
                <dd data-testid="member-notification-email">
                  {profile.notification_email ?? "Not set"}
                </dd>
              </div>
              {profile.auth_login_email ? (
                <div>
                  <dt className="text-muted-foreground">
                    Internal Auth identity (support only)
                  </dt>
                  <dd className="break-all text-muted-foreground">
                    {profile.auth_login_email}
                  </dd>
                </div>
              ) : null}
            </>
          ) : (
            <div>
              <dt className="text-muted-foreground">Sign-in email</dt>
              <dd data-testid="member-sign-in-email">
                {profile.email ?? profile.notification_email ?? "Not available"}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Membership status</dt>
            <dd className="capitalize" data-testid="member-status">
              {profile.status}
            </dd>
          </div>
          {profile.status === "inactive" && profile.status_reason ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Status reason</dt>
              <dd>{profile.status_reason}</dd>
            </div>
          ) : null}
        </dl>
        {profile.status === "inactive" ? (
          <p className="text-sm text-muted-foreground">
            Inactive members lose active organisation access and sessions.
            Notification delivery uses the stored contact only when policy
            allows inactive recipients.
          </p>
        ) : null}
        {canEditMembership ? (
          <form
            onSubmit={handleSaveDisplayName}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-display-name">Update display name</Label>
              <Input
                id="member-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="self-start"
            >
              Save display name
            </Button>
          </form>
        ) : null}
        {canResetCredentials ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              data-testid="reset-workforce-credentials"
              disabled={loading}
              onClick={() => void handleResetCredentials()}
            >
              Reissue temporary credentials
            </Button>
            {resetCredentials ? (
              <p className="text-sm text-muted-foreground" role="status">
                Username: {resetCredentials.username}. Temporary password shown
                once in this session only.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {canManageLifecycle ? (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h2 className="text-base font-semibold">Membership lifecycle</h2>
          {profile.status === "active" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="member-status-reason">
                  Reason for deactivation
                </Label>
                <Input
                  id="member-status-reason"
                  value={statusReason}
                  onChange={(event) => setStatusReason(event.target.value)}
                  placeholder="Required when deactivating"
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="self-start"
                data-testid="deactivate-member"
                disabled={loading}
                onClick={() => void handleSetStatus("inactive")}
              >
                Deactivate employee
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              data-testid="reactivate-member"
              disabled={loading}
              onClick={() => void handleSetStatus("active")}
            >
              Reactivate employee
            </Button>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Organisation</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">
              <ContextualHelpLabel topic="primary-organisational-unit">
                Primary organisation unit
              </ContextualHelpLabel>
            </dt>
            <dd>
              {profile.primary_organisational_unit?.name ?? "Not assigned"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              <ContextualHelpLabel topic="job-function">
                Job function
              </ContextualHelpLabel>
            </dt>
            <dd>{profile.job_function?.name ?? "Not assigned"}</dd>
          </div>
        </dl>
        {canAssignJobFunction && profile.status === "active" ? (
          <form
            onSubmit={handleAssignJobFunction}
            className="flex flex-col gap-3"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="member-job-function">Job function</Label>
                <select
                  id="member-job-function"
                  className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
                  value={jobFunctionId}
                  onChange={(event) => setJobFunctionId(event.target.value)}
                >
                  <option value="">Select job function</option>
                  {jobFunctions.map((jobFunction) => (
                    <option key={jobFunction.id} value={jobFunction.id}>
                      {jobFunction.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="member-primary-unit">
                  Primary organisation unit
                </Label>
                <select
                  id="member-primary-unit"
                  className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
                  value={organisationalUnitId}
                  onChange={(event) =>
                    setOrganisationalUnitId(event.target.value)
                  }
                >
                  <option value="">Select unit</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {formatUnitPath(unit.id, units)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="self-start"
            >
              Save organisation assignment
            </Button>
          </form>
        ) : profile.permissions.is_self ? (
          <p className="text-sm text-muted-foreground">
            Your organisation assignment is managed by an administrator. Visit{" "}
            <a href="/platform/settings/profile" className="underline">
              your profile settings
            </a>{" "}
            for personal details you can update yourself.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ask an Organisation Administrator to update this person&apos;s
            organisation assignment.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Capability</h2>
        <p className="text-sm text-muted-foreground">
          Training, skills, assessments, and improvement activity are managed on
          the{" "}
          <a
            href={`/platform/people/${profile.membership_id}`}
            className="underline"
          >
            capability profile
          </a>
          .
        </p>
      </section>

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function mapMemberAdminError(error: unknown, fallback: string) {
  return toCustomerErrorMessage(error, fallback);
}
