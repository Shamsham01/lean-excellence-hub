"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  identicalNameGuidance,
  MULTI_SITE_INTENT_LABELS,
  MULTI_SITE_INTENTS,
  namesLookAccidentalDuplicate,
  parseMultiSiteIntent,
  type MultiSiteIntent,
} from "@/modules/organisation-rollout/multi-site-intent";

export function FoundingOrganisationForm({
  action,
  error,
}: {
  action: (formData: FormData) => void;
  error?: string;
}) {
  const [organisationName, setOrganisationName] = useState("");
  const [firstSiteName, setFirstSiteName] = useState("");
  const [intent, setIntent] = useState<MultiSiteIntent>("not_sure");

  const showIdenticalNameGuidance = useMemo(
    () => namesLookAccidentalDuplicate(organisationName, firstSiteName, intent),
    [organisationName, firstSiteName, intent],
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-6"
      data-testid="create-organisation-form"
    >
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          Check the organisation details and try again.
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-foreground">
          Organisation
        </legend>
        <p className="text-sm text-muted-foreground">
          What company, business or group does this site belong to?
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="organisationName">Organisation name</Label>
          <Input
            id="organisationName"
            name="organisationName"
            required
            value={organisationName}
            onChange={(event) => setOrganisationName(event.target.value)}
            placeholder="Acme Foods Ltd"
            autoComplete="organization"
            aria-describedby="organisation-name-help"
          />
          <p
            id="organisation-name-help"
            className="text-xs text-muted-foreground"
          >
            This is your Lean Excellence Hub organisation. Additional sites can
            be added to the same organisation later.
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-foreground">
          First site
        </legend>
        <p className="text-sm text-muted-foreground">
          Which site are you setting up first?
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstSiteName">First site</Label>
          <Input
            id="firstSiteName"
            name="firstSiteName"
            required
            value={firstSiteName}
            onChange={(event) => setFirstSiteName(event.target.value)}
            placeholder="Plymouth Factory"
            autoComplete="off"
            aria-describedby="first-site-help"
          />
          <p id="first-site-help" className="text-xs text-muted-foreground">
            This is the operational site where you are starting Lean Excellence
            Hub.
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3" data-testid="multi-site-intent">
        <legend className="text-sm font-medium text-foreground">
          Is this site part of a wider multi-site organisation?
        </legend>
        <p className="text-sm text-muted-foreground">
          You do not need to know the full rollout plan now. This helps Lean
          Excellence Hub talk about organisation and site clearly. It does not
          buy extra sites or grant access.
        </p>
        <div className="flex flex-col gap-2">
          {MULTI_SITE_INTENTS.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name="multiSiteIntent"
                value={value}
                checked={intent === value}
                onChange={(event) => {
                  const next = parseMultiSiteIntent(event.target.value);
                  if (next) {
                    setIntent(next);
                  }
                }}
                className="mt-1 size-4 accent-foreground"
              />
              <span className="text-sm text-foreground">
                {MULTI_SITE_INTENT_LABELS[value]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {showIdenticalNameGuidance ? (
        <p
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground"
          role="status"
          data-testid="identical-name-guidance"
        >
          {identicalNameGuidance(organisationName, firstSiteName)}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="siteQuantity">Paid site quantity</Label>
        <Input
          id="siteQuantity"
          name="siteQuantity"
          type="number"
          min={1}
          max={500}
          defaultValue={1}
          required
        />
        <p className="text-xs text-muted-foreground">
          Start with the sites you are paying for now. You can add subscribed
          capacity later without creating a new organisation.
        </p>
      </div>

      <details className="rounded-md border border-border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Country, locale and reporting details
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="countryCode">Country</Label>
            <Input
              id="countryCode"
              name="countryCode"
              defaultValue="GB"
              maxLength={2}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="locale">Locale</Label>
            <Input id="locale" name="locale" defaultValue="en-GB" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="timeZone">Time zone</Label>
            <Input id="timeZone" name="timeZone" defaultValue="UTC" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reportingCurrency">Reporting currency</Label>
            <Input
              id="reportingCurrency"
              name="reportingCurrency"
              defaultValue="GBP"
              maxLength={3}
              required
            />
          </div>
        </div>
      </details>

      <Button type="submit" className="min-h-11 w-full">
        Continue to plan
      </Button>
    </form>
  );
}
