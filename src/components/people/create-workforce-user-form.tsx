"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { formatUnitPath } from "@/modules/organisation/unit-hierarchy";

import type { CreateWorkforceUserResult } from "@/app/(platform)/platform/settings/people/create/actions";

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

type CreateWorkforceUserFormProps = {
  offers: DelegatableAccessOffer[];
  units: UnitOption[];
  jobFunctions: JobFunctionOption[];
  onCreate: (input: {
    displayName: string;
    username: string;
    jobTitle?: string;
    notificationEmail?: string;
    roleVersionId: string;
    scopeType: string;
    scopeUnitId: string | null;
    jobFunctionId?: string;
    organisationalUnitId?: string;
  }) => Promise<CreateWorkforceUserResult>;
};

type CredentialResult = {
  organisationCode: string;
  username: string;
  displayName: string;
  temporaryPassword: string;
};

export function CreateWorkforceUserForm({
  offers,
  units,
  jobFunctions,
  onCreate,
}: CreateWorkforceUserFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [roleVersionId, setRoleVersionId] = useState(
    offers[0]?.role_version_id ?? "",
  );
  const [scopeKey, setScopeKey] = useState("");
  const [jobFunctionId, setJobFunctionId] = useState("");
  const [organisationalUnitId, setOrganisationalUnitId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialResult | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedOffer = offers.find(
    (offer) => offer.role_version_id === roleVersionId,
  );
  const scopeOptions = selectedOffer?.scope_options ?? [];

  const resolvedScope = useMemo(() => {
    if (!scopeKey) return null;
    const [scopeType, unitId] = scopeKey.split("::");
    return {
      scopeType,
      scopeUnitId: unitId === "null" ? null : unitId,
    };
  }, [scopeKey]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setCredentials(null);
    setAcknowledged(false);

    if (!resolvedScope) {
      setMessage("Select an application role and access scope.");
      return;
    }

    const scopeType = resolvedScope.scopeType;
    if (!scopeType) {
      setMessage("Select an application role and access scope.");
      return;
    }

    setLoading(true);
    const result = await onCreate({
      displayName: displayName.trim(),
      username: username.trim().toLowerCase(),
      ...(jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
      ...(notificationEmail.trim()
        ? { notificationEmail: notificationEmail.trim() }
        : {}),
      roleVersionId,
      scopeType,
      scopeUnitId: resolvedScope.scopeUnitId ?? null,
      ...(jobFunctionId ? { jobFunctionId } : {}),
      ...(organisationalUnitId ? { organisationalUnitId } : {}),
    });
    setLoading(false);

    if ("error" in result) {
      setMessage(result.error);
      return;
    }

    setCredentials({
      organisationCode: result.organisationCode,
      username: result.username,
      displayName: result.displayName,
      temporaryPassword: result.temporaryPassword,
    });
  }

  if (credentials) {
    return (
      <div className="space-y-4" data-testid="workforce-credentials-panel">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Save these sign-in details now.</p>
          <p className="mt-1">
            The temporary password is shown once. It cannot be retrieved later.
            The employee must change it at first sign-in.
          </p>
        </div>
        <dl className="grid gap-3 rounded-lg border p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Organisation code</dt>
            <dd className="font-mono text-base" data-testid="organisation-code">
              {credentials.organisationCode}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Username</dt>
            <dd
              className="font-mono text-base"
              data-testid="workforce-username"
            >
              {credentials.username}
            </dd>
          </div>
          {credentials.temporaryPassword ? (
            <div>
              <dt className="text-muted-foreground">Temporary password</dt>
              <dd
                className="font-mono text-base break-all"
                data-testid="temporary-password"
              >
                {credentials.temporaryPassword}
              </dd>
            </div>
          ) : null}
        </dl>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            I have securely recorded these credentials for the employee.
          </span>
        </label>
        <Button
          type="button"
          disabled={!acknowledged}
          data-testid="create-another-workforce-user"
          onClick={() => {
            setCredentials(null);
            setDisplayName("");
            setUsername("");
            setJobTitle("");
            setNotificationEmail("");
          }}
        >
          Create another employee
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      data-testid="create-workforce-user-form"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <p className="text-xs text-muted-foreground">
          Used for workforce sign-in with the organisation code. Lowercase
          letters, numbers, dots, underscores, and hyphens only.
        </p>
        <Input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          maxLength={128}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jobTitle">Job title</Label>
        <Input
          id="jobTitle"
          value={jobTitle}
          onChange={(event) => setJobTitle(event.target.value)}
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notificationEmail">Notification email (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Optional contact for operational notifications. This is not used for
          workforce sign-in.
        </p>
        <Input
          id="notificationEmail"
          type="email"
          value={notificationEmail}
          onChange={(event) => setNotificationEmail(event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="roleVersionId">Application role</Label>
        <select
          id="roleVersionId"
          className="border-input flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={roleVersionId}
          onChange={(event) => {
            setRoleVersionId(event.target.value);
            setScopeKey("");
          }}
          required
        >
          {offers.map((offer) => (
            <option key={offer.role_version_id} value={offer.role_version_id}>
              {offer.role_display_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scopeKey">Access scope</Label>
        <select
          id="scopeKey"
          className="border-input flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={scopeKey}
          onChange={(event) => setScopeKey(event.target.value)}
          required
        >
          <option value="">Select scope</option>
          {scopeOptions.map((option) => {
            const key = `${option.scope_type}::${option.scope_unit_id ?? "null"}`;
            return (
              <option key={key} value={key}>
                {option.label}
              </option>
            );
          })}
        </select>
      </div>
      {jobFunctions.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="jobFunctionId">Job function (optional)</Label>
          <select
            id="jobFunctionId"
            className="border-input flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={jobFunctionId}
            onChange={(event) => setJobFunctionId(event.target.value)}
          >
            <option value="">None</option>
            {jobFunctions.map((jobFunction) => (
              <option key={jobFunction.id} value={jobFunction.id}>
                {jobFunction.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {units.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="organisationalUnitId">
            Primary work area (optional)
          </Label>
          <select
            id="organisationalUnitId"
            className="border-input flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={organisationalUnitId}
            onChange={(event) => setOrganisationalUnitId(event.target.value)}
            disabled={!jobFunctionId}
          >
            <option value="">None</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {formatUnitPath(unit.id, units)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={loading || offers.length === 0}
        data-testid="submit-create-workforce-user"
      >
        {loading ? "Creating employee..." : "Create employee"}
      </Button>
    </form>
  );
}
