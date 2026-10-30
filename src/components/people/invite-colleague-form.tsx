"use client";

import { useMemo, useState } from "react";

import { ContextualHelpLabel } from "@/components/help/contextual-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUnitPath } from "@/modules/organisation/unit-hierarchy";
import { toCustomerErrorMessage } from "@/modules/people/customer-errors";
import { describeInvitationAccess } from "@/modules/people/invitation-access-preview";
import {
  accessScopeKey,
  customerAccessScopeLabel,
  parseAccessScopeKey,
} from "@/modules/rbac2/access-scope";

export type DelegatableAccessOffer = {
  role_version_id: string;
  role_display_name: string;
  role_canonical_name: string;
  module_responsibility_key?: string | null;
  responsibility_kind?: string | null;
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

type GrantDraft = {
  key: string;
  roleVersionId: string;
  scopeKey: string;
};

type InviteColleagueFormProps = {
  offers: DelegatableAccessOffer[];
  units: UnitOption[];
  jobFunctions: JobFunctionOption[];
  onInvite: (input: {
    email: string;
    displayName?: string;
    grants: Array<{
      roleVersionId: string;
      scopeType: string;
      scopeUnitId: string | null;
    }>;
    jobFunctionId?: string;
    organisationalUnitId?: string;
  }) => Promise<{ error?: string; ok?: true; invitationUrl?: string }>;
};

const MAXIMUM_INVITATION_GRANTS = 10;

function createGrantDraft(key: string): GrantDraft {
  return { key, roleVersionId: "", scopeKey: "" };
}

function operatorSiteOptions(offers: DelegatableAccessOffer[]) {
  const viewer = offers.find(
    (offer) => offer.role_canonical_name === "workplace-viewer",
  );
  const contributor = offers.find(
    (offer) => offer.role_canonical_name === "suggestions-contributor",
  );
  if (!viewer || !contributor) return [];

  const contributorSites = new Set(
    contributor.scope_options
      .filter(
        (scope) => scope.scope_type === "unit_subtree" && scope.scope_unit_id,
      )
      .map((scope) => accessScopeKey(scope)),
  );

  return viewer.scope_options.filter(
    (scope) =>
      scope.scope_type === "unit_subtree" &&
      scope.scope_unit_id &&
      contributorSites.has(accessScopeKey(scope)),
  );
}

export function InviteColleagueForm({
  offers,
  units,
  jobFunctions,
  onInvite,
}: InviteColleagueFormProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [grants, setGrants] = useState<GrantDraft[]>(() => [
    createGrantDraft("grant-1"),
  ]);
  const [grantSequence, setGrantSequence] = useState(1);
  const [jobFunctionId, setJobFunctionId] = useState("");
  const [organisationalUnitId, setOrganisationalUnitId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [operatorSiteKey, setOperatorSiteKey] = useState("");
  const operatorSites = useMemo(() => operatorSiteOptions(offers), [offers]);

  const resolvedGrants = useMemo(
    () =>
      grants.map((grant) => {
        const offer = offers.find(
          (candidate) => candidate.role_version_id === grant.roleVersionId,
        );
        const scope = grant.scopeKey
          ? parseAccessScopeKey(grant.scopeKey)
          : null;
        const scopeOption = offer?.scope_options.find(
          (option) => accessScopeKey(option) === grant.scopeKey,
        );
        return { grant, offer, scope, scopeOption };
      }),
    [grants, offers],
  );

  function updateGrant(key: string, patch: Partial<GrantDraft>) {
    setGrants((current) =>
      current.map((grant) =>
        grant.key === key ? { ...grant, ...patch } : grant,
      ),
    );
  }

  function addGrant() {
    setGrantSequence((current) => current + 1);
    setGrants((current) => [
      ...current,
      createGrantDraft(`grant-${grantSequence + 1}`),
    ]);
  }

  function removeGrant(key: string) {
    setGrants((current) => current.filter((grant) => grant.key !== key));
  }

  function applyOperatorPreset() {
    const viewer = offers.find(
      (offer) => offer.role_canonical_name === "workplace-viewer",
    );
    const contributor = offers.find(
      (offer) => offer.role_canonical_name === "suggestions-contributor",
    );
    if (!viewer || !contributor || !operatorSiteKey) {
      setMessage("Choose a site before applying Operator access.");
      return;
    }

    setGrantSequence((current) => current + 2);
    setGrants([
      {
        key: `grant-operator-view-${grantSequence + 1}`,
        roleVersionId: viewer.role_version_id,
        scopeKey: operatorSiteKey,
      },
      {
        key: `grant-operator-submit-${grantSequence + 2}`,
        roleVersionId: contributor.role_version_id,
        scopeKey: operatorSiteKey,
      },
    ]);
    setMessage(
      "Operator access is ready to edit. Workplace Viewer and Suggestions Contributor use the site you chose.",
    );
    setSuccessUrl(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setSuccessUrl(null);
    setCopied(false);

    if (resolvedGrants.some((entry) => !entry.offer)) {
      setMessage("Select an application role for every row.");
      setLoading(false);
      return;
    }

    if (resolvedGrants.some((entry) => !entry.scope?.scopeType)) {
      setMessage("Select an access scope for every role.");
      setLoading(false);
      return;
    }

    const submittedGrants = resolvedGrants.flatMap((entry) => {
      if (!entry.scope?.scopeType) return [];
      return [
        {
          roleVersionId: entry.grant.roleVersionId,
          scopeType: entry.scope.scopeType,
          scopeUnitId: entry.scope.scopeUnitId,
        },
      ];
    });
    const identities = new Set(
      submittedGrants.map(
        (grant) =>
          `${grant.roleVersionId}::${grant.scopeType}::${grant.scopeUnitId ?? ""}`,
      ),
    );
    if (identities.size !== submittedGrants.length) {
      setMessage(
        "Each role can only be offered once for the same scope. Remove the duplicate before creating the invitation.",
      );
      setLoading(false);
      return;
    }

    const result = await onInvite({
      email: email.trim().toLowerCase(),
      ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      grants: submittedGrants,
      ...(jobFunctionId ? { jobFunctionId } : {}),
      ...(organisationalUnitId ? { organisationalUnitId } : {}),
    });

    if (result.error) {
      setMessage(result.error);
    } else {
      setEmail("");
      setDisplayName("");
      setGrants([createGrantDraft("grant-1")]);
      setGrantSequence(1);
      setJobFunctionId("");
      setOrganisationalUnitId("");
      setSuccessUrl(result.invitationUrl ?? null);
      setMessage(
        "Invitation created. Copy the secure link below — email delivery is not sent from this screen.",
      );
    }

    setLoading(false);
  }

  async function handleCopyInvitationLink() {
    if (!successUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(successUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Unable to copy the invitation link. Copy it manually below.");
      setCopied(false);
    }
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
          <Label htmlFor="invite-display-name">Name</Label>
          <Input
            id="invite-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Sarah Jones"
            maxLength={120}
            autoComplete="name"
          />
          <p className="text-xs text-muted-foreground">
            This is the name used in this organisation. The person can confirm
            or correct it when they join. A name they already use on their
            personal profile stays on their account.
          </p>
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
          <p className="text-xs text-muted-foreground">
            Job function does not grant permissions.
          </p>
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

      {operatorSites.length > 0 ? (
        <section
          className="flex flex-col gap-3"
          aria-labelledby="operator-access-heading"
          data-testid="operator-access-preset"
        >
          <h3
            id="operator-access-heading"
            className="text-sm font-medium text-foreground"
          >
            Operator access
          </h3>
          <p className="text-xs text-muted-foreground">
            Adds Workplace Viewer and Suggestions Contributor at one site. You
            can change or remove either role before creating the invitation. Job
            function does not grant these permissions.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor="operator-access-site">Operator site</Label>
              <select
                id="operator-access-site"
                className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
                value={operatorSiteKey}
                onChange={(event) => setOperatorSiteKey(event.target.value)}
              >
                <option value="">Select a site</option>
                {operatorSites.map((site) => {
                  const key = accessScopeKey(site);
                  return (
                    <option key={key} value={key}>
                      {customerAccessScopeLabel(site)}
                    </option>
                  );
                })}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              data-testid="apply-operator-access"
              onClick={applyOperatorPreset}
            >
              Apply Operator access
            </Button>
          </div>
        </section>
      ) : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium text-foreground">
          Application roles
        </legend>
        <p className="text-xs text-muted-foreground">
          Add each role separately. Editing in one site and viewing in another
          stays limited to those scopes. Entire organisation covers every site.
        </p>
        {resolvedGrants.map((entry, index) => {
          const roleId = index === 0 ? "invite-role" : `invite-role-${index}`;
          const scopeId =
            index === 0 ? "invite-scope" : `invite-scope-${index}`;
          const scopeOptions = entry.offer?.scope_options ?? [];
          return (
            <div
              key={entry.grant.key}
              className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              data-testid={`invite-grant-row-${index}`}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor={roleId}>
                  {index === 0 ? (
                    <ContextualHelpLabel topic="application-role">
                      Application role
                    </ContextualHelpLabel>
                  ) : (
                    `Application role ${index + 1}`
                  )}
                </Label>
                <select
                  id={roleId}
                  className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
                  value={entry.grant.roleVersionId}
                  onChange={(event) =>
                    updateGrant(entry.grant.key, {
                      roleVersionId: event.target.value,
                      scopeKey: "",
                    })
                  }
                  required
                >
                  <option value="">Select a role</option>
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
                <Label htmlFor={scopeId}>
                  {index === 0 ? (
                    <ContextualHelpLabel topic="access-scope">
                      Access scope
                    </ContextualHelpLabel>
                  ) : (
                    `Access scope ${index + 1}`
                  )}
                </Label>
                <select
                  id={scopeId}
                  className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
                  value={entry.grant.scopeKey}
                  onChange={(event) =>
                    updateGrant(entry.grant.key, {
                      scopeKey: event.target.value,
                    })
                  }
                  required
                  disabled={!entry.offer}
                >
                  <option value="">Select scope</option>
                  {scopeOptions.map((scope) => {
                    const key = accessScopeKey(scope);
                    return (
                      <option key={key} value={key}>
                        {customerAccessScopeLabel(scope)}
                      </option>
                    );
                  })}
                </select>
              </div>
              {grants.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 self-end"
                  onClick={() => removeGrant(entry.grant.key)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          );
        })}
        {grants.length < MAXIMUM_INVITATION_GRANTS ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 self-start"
            data-testid="add-invitation-grant"
            onClick={addGrant}
          >
            Add another role
          </Button>
        ) : null}
      </fieldset>

      <section
        className="flex flex-col gap-3 text-sm"
        aria-labelledby="invitation-access-preview-heading"
        data-testid="invitation-access-preview"
      >
        <h3
          id="invitation-access-preview-heading"
          className="font-medium text-foreground"
        >
          Effective access
        </h3>
        <p className="text-xs text-muted-foreground">
          Job function does not grant permissions. Each role below applies only
          to the scope selected for that row.
        </p>
        {resolvedGrants.some((entry) => entry.offer) ? (
          <ul className="flex flex-col gap-3">
            {resolvedGrants.map((entry) => {
              if (!entry.offer) return null;
              const preview = describeInvitationAccess(entry.offer);
              const scopeLabel = entry.scopeOption
                ? customerAccessScopeLabel(entry.scopeOption)
                : "Choose a scope for this role.";
              return (
                <li key={entry.grant.key}>
                  <p className="font-medium text-foreground">
                    {entry.offer.role_display_name}
                  </p>
                  <p className="text-muted-foreground">Scope: {scopeLabel}</p>
                  <p className="text-muted-foreground">
                    Viewing: {preview.viewing}
                  </p>
                  <p className="text-muted-foreground">
                    Contribution: {preview.contribution}
                  </p>
                  <p className="text-muted-foreground">
                    Management: {preview.management}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            Select a role to see the access this invitation will grant.
          </p>
        )}
      </section>

      {message ? (
        <p
          className={`text-sm ${successUrl ? "text-foreground" : "text-destructive"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      {successUrl ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs break-all text-muted-foreground">
            Invitation link: {successUrl}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 self-start"
            data-testid="copy-invitation-link-button"
            onClick={() => void handleCopyInvitationLink()}
          >
            {copied ? "Copied" : "Copy invitation link"}
          </Button>
        </div>
      ) : null}

      <Button type="submit" disabled={loading} className="min-h-11 self-start">
        {loading ? "Creating invitation…" : "Create invitation"}
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
