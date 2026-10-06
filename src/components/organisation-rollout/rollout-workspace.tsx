"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createRolloutSite,
  grantRolloutSiteAccess,
  inviteRolloutSiteAccess,
} from "@/app/(platform)/platform/settings/organisation/rollout/actions";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADD_SITE_CAPACITY_HREF } from "@/modules/billing/site-capacity-increase";
import {
  formatRemainingSiteSlots,
  formatSubscribedSitesActive,
} from "@/modules/billing/site-capacity";
import type {
  PublishedMaturityFramework,
  RolloutMemberOption,
} from "@/modules/organisation-rollout/queries";
import type { OrganisationGovernanceSnapshot } from "@/modules/organisation-rollout/governance";
import {
  accessScopeKey,
  customerAccessScopeDescription,
  customerAccessScopeLabel,
  preferredSiteScopeKey,
} from "@/modules/rbac2/access-scope";

type RolloutStep = "capacity" | "site" | "leadership" | "standards";

export function RolloutWorkspace({
  governance,
  members,
  offers,
  publishedFrameworks,
  createdSiteId,
  createdSiteName,
}: {
  governance: OrganisationGovernanceSnapshot;
  members: RolloutMemberOption[];
  offers: DelegatableAccessOffer[];
  publishedFrameworks: PublishedMaturityFramework[];
  createdSiteId?: string;
  createdSiteName?: string;
}) {
  const capacity = governance.siteCapacity;
  const remaining = capacity?.remainingSlots ?? null;
  const canCreateSite =
    governance.canManageHierarchy &&
    (capacity === null || !capacity.enforced || (remaining ?? 0) > 0);
  const exhausted = capacity?.enforced === true && remaining === 0;

  const initialStep: RolloutStep = createdSiteId
    ? "leadership"
    : canCreateSite
      ? "site"
      : "capacity";
  const [step, setStep] = useState<RolloutStep>(initialStep);
  const [siteName, setSiteName] = useState(createdSiteName ?? "");
  const [siteId, setSiteId] = useState(createdSiteId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const siteOffers = useMemo(
    () =>
      offers
        .map((offer) => ({
          ...offer,
          scope_options: offer.scope_options.filter(
            (scope) =>
              scope.scope_type === "unit_subtree" &&
              scope.scope_unit_id === siteId,
          ),
        }))
        .filter((offer) => offer.scope_options.length > 0),
    [offers, siteId],
  );

  const capacityHeadline =
    capacity?.enforced && capacity.subscribedLimit !== null
      ? formatSubscribedSitesActive(
          capacity.activeSiteCount,
          capacity.subscribedLimit,
        )
      : `${governance.activeSiteCount} active sites`;

  return (
    <div className="flex flex-col gap-8" data-testid="rollout-workspace">
      <ol className="flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
        {(["capacity", "site", "leadership", "standards"] as const).map(
          (key, index) => (
            <li
              key={key}
              className={step === key ? "text-foreground" : undefined}
            >
              {index + 1}. {stepTitle(key)}
            </li>
          ),
        )}
      </ol>

      {step === "capacity" ? (
        <section
          className="flex flex-col gap-4"
          data-testid="rollout-step-capacity"
        >
          <h2 className="text-base font-medium text-foreground">Capacity</h2>
          <p
            className="text-sm font-medium text-foreground"
            data-testid="rollout-capacity-headline"
          >
            {capacityHeadline}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatRemainingSiteSlots(remaining) ??
              "Site capacity is not limited by a current subscription."}
          </p>
          {exhausted ? (
            governance.canManageBilling ? (
              <Button asChild className="min-h-11 self-start">
                <AppLink
                  href={ADD_SITE_CAPACITY_HREF}
                  data-testid="rollout-add-capacity"
                >
                  Add site capacity
                </AppLink>
              </Button>
            ) : (
              <p
                className="text-sm text-muted-foreground"
                data-testid="rollout-billing-required"
              >
                A billing administrator must increase subscribed site capacity
                before another site can be created.
              </p>
            )
          ) : canCreateSite ? (
            <Button
              type="button"
              className="min-h-11 self-start"
              onClick={() => setStep("site")}
            >
              Continue
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Capacity is available. Ask an authorised hierarchy administrator
              to create the site.
            </p>
          )}
        </section>
      ) : null}

      {step === "site" ? (
        <section
          className="flex flex-col gap-4"
          data-testid="rollout-step-site"
        >
          <h2 className="text-base font-medium text-foreground">New site</h2>
          <p className="text-sm text-muted-foreground">
            Create the next operational site in {governance.organisationName}.
            This uses the same site-capacity rules as Organisation structure.
          </p>
          <form
            className="flex max-w-md flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage(null);
              startTransition(async () => {
                const result = await createRolloutSite({ name: siteName });
                if ("error" in result) {
                  setMessage(result.error);
                  return;
                }
                if (result.siteId) {
                  setSiteId(result.siteId);
                  setSiteName(result.siteName);
                  setStep("leadership");
                }
              });
            }}
          >
            <Label htmlFor="rollout-site-name">Site name</Label>
            <Input
              id="rollout-site-name"
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              placeholder="Bristol Factory"
              required
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={pending} className="min-h-11">
                {pending ? "Creating…" : "Create site"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setStep("capacity")}
              >
                Back
              </Button>
            </div>
          </form>
          {message ? (
            <p className="text-sm text-destructive" role="alert">
              {message}
            </p>
          ) : null}
        </section>
      ) : null}

      {step === "leadership" ? (
        <SiteLeadershipStep
          siteId={siteId}
          siteName={siteName}
          members={members}
          offers={siteOffers}
          canInvite={governance.canInvite}
          canDelegate={governance.canDelegateRoles}
          pending={pending}
          invitationUrl={invitationUrl}
          message={message}
          onBack={() => setStep("site")}
          onContinue={() => setStep("standards")}
          onGrant={(input) => {
            setMessage(null);
            setInvitationUrl(null);
            startTransition(async () => {
              const result = await grantRolloutSiteAccess(input);
              if ("error" in result && result.error) {
                setMessage(result.error);
                return;
              }
              setMessage("Site access granted.");
              setStep("standards");
            });
          }}
          onInvite={(input) => {
            setMessage(null);
            setInvitationUrl(null);
            startTransition(async () => {
              const result = await inviteRolloutSiteAccess(input);
              if ("error" in result && result.error) {
                setMessage(result.error);
                return;
              }
              if ("invitationUrl" in result) {
                setInvitationUrl(result.invitationUrl ?? null);
              }
              setMessage("Invitation created.");
            });
          }}
        />
      ) : null}

      {step === "standards" ? (
        <section
          className="flex flex-col gap-4"
          data-testid="rollout-step-standards"
        >
          <h2 className="text-base font-medium text-foreground">
            Shared standards, local execution
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Organisation standards can be reused while work stays local to each
            site. Maturity Frameworks belong to {governance.organisationName}.
            Assessments and results belong to the site.
          </p>
          {publishedFrameworks.length > 0 ? (
            <ul
              className="flex flex-col gap-2"
              data-testid="rollout-shared-frameworks"
            >
              {publishedFrameworks.map((framework) => (
                <li
                  key={framework.versionId}
                  className="text-sm text-foreground"
                >
                  {framework.name}
                  <span className="text-muted-foreground">
                    {` · version ${framework.versionNumber} · shared`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No published Maturity Framework yet. Create one for the
              organisation, then start a separate assessment for this site.
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="min-h-11">
              <AppLink
                href={
                  publishedFrameworks[0]
                    ? `/platform/maturity/assessments/new?versionId=${publishedFrameworks[0].versionId}`
                    : "/platform/maturity/models"
                }
                data-testid="rollout-maturity-next"
              >
                {publishedFrameworks[0]
                  ? `Set up ${siteName || "this site"}’s first assessment`
                  : "Create a Maturity Framework"}
              </AppLink>
            </Button>
            <Button variant="outline" asChild className="min-h-11">
              <AppLink href="/platform/settings/organisation">
                Back to organisation
              </AppLink>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function stepTitle(step: RolloutStep) {
  switch (step) {
    case "capacity":
      return "Capacity";
    case "site":
      return "Site";
    case "leadership":
      return "Local access";
    case "standards":
      return "Standards";
  }
}

function SiteLeadershipStep({
  siteId,
  siteName,
  members,
  offers,
  canInvite,
  canDelegate,
  pending,
  invitationUrl,
  message,
  onBack,
  onContinue,
  onGrant,
  onInvite,
}: {
  siteId: string;
  siteName: string;
  members: RolloutMemberOption[];
  offers: DelegatableAccessOffer[];
  canInvite: boolean;
  canDelegate: boolean;
  pending: boolean;
  invitationUrl: string | null;
  message: string | null;
  onBack: () => void;
  onContinue: () => void;
  onGrant: (input: {
    membershipId: string;
    roleVersionId: string;
    scopeKey: string;
    siteId: string;
  }) => void;
  onInvite: (input: {
    email: string;
    displayName?: string;
    roleVersionId: string;
    scopeKey: string;
    siteId: string;
  }) => void;
}) {
  const [mode, setMode] = useState<"existing" | "invite">("existing");
  const defaultOffer = offers.find((offer) =>
    offer.scope_options.some(
      (scope) =>
        scope.scope_type === "unit_subtree" && scope.scope_unit_id === siteId,
    ),
  );
  const [roleVersionId, setRoleVersionId] = useState(
    defaultOffer?.role_version_id ?? offers[0]?.role_version_id ?? "",
  );
  const selectedOffer =
    offers.find((offer) => offer.role_version_id === roleVersionId) ??
    defaultOffer ??
    offers[0];
  const defaultScope = preferredSiteScopeKey(
    selectedOffer?.scope_options ?? [],
    siteId,
  );
  const [scopeKey, setScopeKey] = useState(defaultScope);
  const [membershipId, setMembershipId] = useState(
    members[0]?.membershipId ?? "",
  );
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const resolvedScopeKey =
    scopeKey ||
    preferredSiteScopeKey(selectedOffer?.scope_options ?? [], siteId);

  return (
    <section
      className="flex flex-col gap-4"
      data-testid="rollout-step-leadership"
    >
      <h2 className="text-base font-medium text-foreground">
        Who will manage {siteName || "this site"}?
      </h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Grant an existing published role for this site. Do not invent
        permissions from job titles, and do not grant organisation-wide access
        unless that is the role you intend.
      </p>
      {!canDelegate || offers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You cannot delegate access for this site. Continue to standards, or
          ask an organisation administrator to assign local access in People.
        </p>
      ) : (
        <form
          className="flex max-w-xl flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!resolvedScopeKey) {
              return;
            }
            if (mode === "existing") {
              onGrant({
                membershipId,
                roleVersionId,
                scopeKey: resolvedScopeKey,
                siteId,
              });
              return;
            }
            onInvite({
              email,
              ...(displayName.trim()
                ? { displayName: displayName.trim() }
                : {}),
              roleVersionId,
              scopeKey: resolvedScopeKey,
              siteId,
            });
          }}
        >
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="leadership-mode"
                checked={mode === "existing"}
                onChange={() => setMode("existing")}
              />
              Existing member
            </label>
            {canInvite ? (
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="leadership-mode"
                  checked={mode === "invite"}
                  onChange={() => setMode("invite")}
                />
                Invite someone
              </label>
            ) : null}
          </div>

          {mode === "existing" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="rollout-member">Member</Label>
              <select
                id="rollout-member"
                className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
                value={membershipId}
                onChange={(event) => setMembershipId(event.target.value)}
                required
              >
                {members.map((member) => (
                  <option key={member.membershipId} value={member.membershipId}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rollout-invite-email">Email</Label>
                <Input
                  id="rollout-invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rollout-invite-name">
                  Display name (optional)
                </Label>
                <Input
                  id="rollout-invite-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="rollout-role">Application role</Label>
            <select
              id="rollout-role"
              className="border-input min-h-11 rounded-md border bg-background px-3 text-sm"
              value={roleVersionId}
              onChange={(event) => {
                setRoleVersionId(event.target.value);
                setScopeKey("");
              }}
              required
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

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Access scope</legend>
            {(selectedOffer?.scope_options ?? []).map((scope) => {
              const key = accessScopeKey(scope);
              return (
                <label key={key} className="flex items-start gap-3 text-sm">
                  <input
                    type="radio"
                    name="rollout-scope"
                    value={key}
                    checked={resolvedScopeKey === key}
                    onChange={() => setScopeKey(key)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      {customerAccessScopeLabel(scope)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {customerAccessScopeDescription(scope.scope_type)}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" disabled={pending} className="min-h-11">
              {pending
                ? "Saving…"
                : mode === "existing"
                  ? "Grant site access"
                  : "Create invitation"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={onContinue}
            >
              Skip for now
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={onBack}
            >
              Back
            </Button>
          </div>
        </form>
      )}
      {message ? (
        <p className="text-sm text-foreground" role="status">
          {message}
        </p>
      ) : null}
      {invitationUrl ? (
        <p className="text-xs break-all text-muted-foreground">
          Invitation link: {invitationUrl}
        </p>
      ) : null}
      {!canDelegate || offers.length === 0 ? (
        <Button
          type="button"
          className="min-h-11 self-start"
          onClick={onContinue}
        >
          Continue to standards
        </Button>
      ) : null}
    </section>
  );
}
