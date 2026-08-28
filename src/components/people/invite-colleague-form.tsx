"use client";

import { useMemo, useState } from "react";

import { ContextualHelpLabel } from "@/components/help/contextual-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUnitPath } from "@/modules/organisation/unit-hierarchy";
import { toCustomerErrorMessage } from "@/modules/people/customer-errors";

export type DelegatableAccessOffer = {
  role_version_id: string;
  role_display_name: string;
  role_canonical_name: string;
  scope_options: Array<{
    scope_type: string;
    scope_unit_id: string | null;
    label: string;
    unit_code?: string;
  }>;
};

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

type InviteColleagueFormProps = {
  offers: DelegatableAccessOffer[];
  units: UnitOption[];
  jobFunctions: JobFunctionOption[];
  onInvite: (input: {
    email: string;
    displayName?: string;
    roleVersionId: string;
    scopeType: string;
    scopeUnitId: string | null;
    jobFunctionId?: string;
    organisationalUnitId?: string;
  }) => Promise<{ error?: string; ok?: true; invitationUrl?: string }>;
};

export function InviteColleagueForm({
  offers,
  units,
  jobFunctions,
  onInvite,
}: InviteColleagueFormProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleVersionId, setRoleVersionId] = useState(offers[0]?.role_version_id ?? "");
  const [scopeKey, setScopeKey] = useState("");
  const [jobFunctionId, setJobFunctionId] = useState("");
  const [organisationalUnitId, setOrganisationalUnitId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setSuccessUrl(null);

    if (!resolvedScope) {
      setMessage("Select an access scope.");
      setLoading(false);
      return;
    }

    const result = await onInvite({
      email: email.trim().toLowerCase(),
      ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      roleVersionId,
      scopeType: resolvedScope.scopeType ?? "",
      scopeUnitId: resolvedScope.scopeUnitId ?? null,
      ...(jobFunctionId ? { jobFunctionId } : {}),
      ...(organisationalUnitId ? { organisationalUnitId } : {}),
    });

    if (result.error) {
      setMessage(result.error);
    } else {
      setEmail("");
      setDisplayName("");
      setJobFunctionId("");
      setOrganisationalUnitId("");
      setSuccessUrl(result.invitationUrl ?? null);
      setMessage("Invitation sent. Share the invitation link with your colleague.");
    }

    setLoading(false);
  }

  if (offers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No application roles are available for you to delegate. Ask an
        organisation administrator to review your access.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit}
      data-testid="invite-colleague-form"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">Colleague email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-display-name">Display name (optional)</Label>
          <Input
            id="invite-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Sarah Jones"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-job-function">
            <ContextualHelpLabel topic="job-function">
              Job function (optional)
            </ContextualHelpLabel>
          </Label>
          <select
            id="invite-job-function"
            className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
            value={jobFunctionId}
            onChange={(event) => setJobFunctionId(event.target.value)}
          >
            <option value="">Select later</option>
            {jobFunctions.map((jobFunction) => (
              <option key={jobFunction.id} value={jobFunction.id}>
                {jobFunction.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-primary-unit">
            <ContextualHelpLabel topic="primary-organisational-unit">
              Primary organisation unit (optional)
            </ContextualHelpLabel>
          </Label>
          <select
            id="invite-primary-unit"
            className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
            value={organisationalUnitId}
            onChange={(event) => setOrganisationalUnitId(event.target.value)}
          >
            <option value="">Select later</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {formatUnitPath(unit.id, units)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-role">
            <ContextualHelpLabel topic="application-role">
              Application role
            </ContextualHelpLabel>
          </Label>
          <select
            id="invite-role"
            className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-scope">
            <ContextualHelpLabel topic="access-scope">
              Access scope
            </ContextualHelpLabel>
          </Label>
          <select
            id="invite-scope"
            className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
            value={scopeKey}
            onChange={(event) => setScopeKey(event.target.value)}
            required
          >
            <option value="">Select scope</option>
            {scopeOptions.map((scope) => {
              const key = `${scope.scope_type}::${scope.scope_unit_id ?? "null"}`;
              return (
                <option key={key} value={key}>
                  {scope.label}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {message ? (
        <p
          className={`text-sm ${successUrl ? "text-foreground" : "text-destructive"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      {successUrl ? (
        <p className="break-all text-xs text-muted-foreground">
          Invitation link: {successUrl}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="min-h-11 self-start">
        {loading ? "Sending invitation…" : "Send invitation"}
      </Button>
    </form>
  );
}

export function mapInviteError(error: unknown) {
  return toCustomerErrorMessage(
    error,
    "Unable to send the invitation. Check the details and try again.",
  );
}
