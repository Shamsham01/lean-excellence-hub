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
  scope_type: string;
  scope_unit_name: string | null;
  status: string;
};

export type MemberAdministrationProfile = {
  membership_id: string;
  display_name: string | null;
  email: string | null;
  status: string;
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
};

export function MemberAdministrationPanel({
  profile,
  units,
  jobFunctions,
  onUpdateDisplayName,
  onAssignJobFunction,
}: MemberAdministrationPanelProps) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [jobFunctionId, setJobFunctionId] = useState(
    profile.job_function?.id ?? "",
  );
  const [organisationalUnitId, setOrganisationalUnitId] = useState(
    profile.primary_organisational_unit?.id ?? "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canEditMembership =
    profile.permissions.can_manage_membership && !profile.permissions.is_self;
  const canAssignJobFunction = profile.permissions.can_manage_job_functions;

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
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{profile.email ?? "Not available"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Membership status</dt>
            <dd className="capitalize">{profile.status}</dd>
          </div>
        </dl>
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
      </section>

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
        {canAssignJobFunction ? (
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
