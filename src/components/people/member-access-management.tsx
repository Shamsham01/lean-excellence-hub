"use client";

import { useMemo, useState } from "react";

import { ContextualHelpLabel } from "@/components/help/contextual-help";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  isModuleResponsibilityOffer,
  responsibilityDisplayName,
  responsibilityScopeLabel,
} from "@/modules/rbac2/responsibilities";

type AccessGrant = {
  grant_id: string;
  role_display_name: string;
  role_canonical_name?: string | null;
  module_responsibility_key?: string | null;
  responsibility_kind?: string | null;
  scope_type: string;
  scope_unit_name: string | null;
  status: string;
};

function groupOffers(offers: DelegatableAccessOffer[]) {
  const moduleOffers = offers.filter((offer) =>
    isModuleResponsibilityOffer(offer.responsibility_kind),
  );
  const advancedOffers = offers.filter(
    (offer) => !isModuleResponsibilityOffer(offer.responsibility_kind),
  );

  return { moduleOffers, advancedOffers };
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
  const [showAdvancedOffers, setShowAdvancedOffers] = useState(false);

  const { moduleOffers, advancedOffers } = useMemo(
    () => groupOffers(offers),
    [offers],
  );
  const visibleOffers = showAdvancedOffers
    ? [...moduleOffers, ...advancedOffers]
    : moduleOffers.length > 0
      ? moduleOffers
      : offers;

  const selectedOffer = visibleOffers.find(
    (offer) => offer.role_version_id === roleVersionId,
  );
  const scopeOptions = selectedOffer?.scope_options ?? [];

  const responsibilityGrants = grants.filter(
    (grant) =>
      grant.responsibility_kind === "module" ||
      grant.responsibility_kind === "admin",
  );
  const otherGrants = grants.filter(
    (grant) =>
      grant.responsibility_kind !== "module" &&
      grant.responsibility_kind !== "admin",
  );

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
      setMessage("Select a responsibility and scope.");
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
          ? "Responsibility granted."
          : "Unable to grant responsibility."),
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
          ? "Responsibility revoked."
          : "Unable to revoke responsibility."),
    );
    setLoading(false);
  }

  function renderGrantList(items: AccessGrant[]) {
    return (
      <ul className="flex flex-col gap-2">
        {items.map((grant) => (
          <li
            key={grant.grant_id}
            className="flex flex-col gap-3 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            data-testid="responsibility-grant-row"
          >
            <div>
              <p className="font-medium">{responsibilityDisplayName(grant)}</p>
              <p className="text-muted-foreground">
                {responsibilityScopeLabel(grant)}
              </p>
            </div>
            {canManage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => handleRevoke(grant.grant_id)}
              >
                Remove
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="member-access-management">
      {responsibilityGrants.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Responsibilities</h3>
          {renderGrantList(responsibilityGrants)}
        </div>
      ) : null}

      {otherGrants.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Other access grants</h3>
          {renderGrantList(otherGrants)}
        </div>
      ) : null}

      {!grants.length ? (
        <p className="text-sm text-muted-foreground">
          No module responsibilities assigned. Active members still receive
          baseline participation for eligible workflows.
        </p>
      ) : null}

      {canManage ? (
        visibleOffers.length ? (
          <form
            onSubmit={handleGrant}
            className="flex flex-col gap-4 border-t border-border pt-4"
          >
            <p className="text-sm text-muted-foreground">
              Add a module responsibility with an independent scope.
              Organisation placement is managed separately above.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="grant-role">
                  <ContextualHelpLabel topic="application-role">
                    Responsibility
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
                  {visibleOffers.map((offer) => (
                    <option
                      key={offer.role_version_id}
                      value={offer.role_version_id}
                    >
                      {responsibilityDisplayName(offer)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="grant-scope">
                  <ContextualHelpLabel topic="access-scope">
                    Scope
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
            {advancedOffers.length ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start px-0"
                onClick={() => setShowAdvancedOffers((current) => !current)}
              >
                {showAdvancedOffers
                  ? "Hide advanced / legacy roles"
                  : "Show advanced / legacy roles"}
              </Button>
            ) : null}
            <Button
              type="submit"
              disabled={loading}
              size="sm"
              className="self-start"
            >
              Add responsibility
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            No delegatable responsibilities are available for you to assign.
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
