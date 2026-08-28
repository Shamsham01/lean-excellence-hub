"use client";

import { useMemo, useState } from "react";

import { ContextualHelpLabel } from "@/components/help/contextual-help";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type AccessGrant = {
  grant_id: string;
  role_display_name: string;
  scope_type: string;
  scope_unit_name: string | null;
  status: string;
};

function scopeLabel(grant: AccessGrant) {
  if (grant.scope_type === "organisation") {
    return "Entire organisation";
  }
  if (grant.scope_unit_name) {
    return grant.scope_unit_name;
  }
  return grant.scope_type;
}

export function MemberAccessManagement({
  grants,
  offers,
  canManage,
  onGrant,
  onRevoke,
}: {
  grants: AccessGrant[];
  offers: DelegatableAccessOffer[];
  canManage: boolean;
  onGrant: (input: {
    roleVersionId: string;
    scopeType: string;
    scopeUnitId: string | null;
  }) => Promise<{ error?: string; ok?: true }>;
  onRevoke: (grantId: string) => Promise<{ error?: string; ok?: true }>;
}) {
  const [roleVersionId, setRoleVersionId] = useState(
    offers[0]?.role_version_id ?? "",
  );
  const [scopeKey, setScopeKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
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

  async function handleGrant(event: React.FormEvent) {
    event.preventDefault();
    if (!resolvedScope?.scopeType) {
      setMessage("Select an application role and access scope.");
      return;
    }

    setLoading(true);
    setMessage(null);
    const result = await onGrant({
      roleVersionId,
      scopeType: resolvedScope.scopeType,
      scopeUnitId: resolvedScope.scopeUnitId ?? null,
    });
    setMessage(
      result.error ??
        (result.ok
          ? "Application access updated."
          : "Unable to update access."),
    );
    setLoading(false);
  }

  async function handleRevoke(grantId: string) {
    setLoading(true);
    setMessage(null);
    const result = await onRevoke(grantId);
    setMessage(
      result.error ??
        (result.ok
          ? "Application access revoked."
          : "Unable to revoke access."),
    );
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="member-access-management">
      {grants.length ? (
        <ul className="flex flex-col gap-2">
          {grants.map((grant) => (
            <li
              key={grant.grant_id}
              className="flex flex-col gap-3 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{grant.role_display_name}</p>
                <p className="text-muted-foreground">{scopeLabel(grant)}</p>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => handleRevoke(grant.grant_id)}
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No active application access grants.
        </p>
      )}

      {canManage ? (
        offers.length ? (
          <form
            onSubmit={handleGrant}
            className="flex flex-col gap-4 border-t border-border pt-4"
          >
            <p className="text-sm text-muted-foreground">
              Grant application access using roles and scopes you are authorised
              to delegate.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="grant-role">
                  <ContextualHelpLabel topic="application-role">
                    Application role
                  </ContextualHelpLabel>
                </Label>
                <select
                  id="grant-role"
                  className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
                  value={roleVersionId}
                  onChange={(event) => {
                    setRoleVersionId(event.target.value);
                    setScopeKey("");
                  }}
                >
                  {offers.map((offer) => (
                    <option
                      key={offer.role_version_id}
                      value={offer.role_version_id}
                    >
                      {offer.role_display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="grant-scope">
                  <ContextualHelpLabel topic="access-scope">
                    Access scope
                  </ContextualHelpLabel>
                </Label>
                <select
                  id="grant-scope"
                  className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
                  value={scopeKey}
                  onChange={(event) => setScopeKey(event.target.value)}
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
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="self-start"
            >
              Grant application access
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            No delegatable application roles are available for you to assign.
          </p>
        )
      ) : null}

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
