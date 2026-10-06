"use client";

import { useState, useTransition } from "react";

import { confirmOrganisationContext } from "@/app/onboarding/setup/actions";
import { Button } from "@/components/ui/button";
import { hardNavigate } from "@/lib/navigation/navigate";
import type { StructureFirstFacts } from "@/modules/organisation-onboarding";
import {
  MULTI_SITE_INTENT_LABELS,
  resolveMultiSiteIntent,
} from "@/modules/organisation-rollout/multi-site-intent";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function OrganisationContextStep({
  facts,
}: {
  facts: StructureFirstFacts;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      const result = await confirmOrganisationContext();
      if (result.error) {
        setError(result.error);
        return;
      }
      hardNavigate("/onboarding/setup?step=structure");
    });
  }

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="structure-first-organisation-step"
      aria-labelledby="organisation-context-heading"
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Organisation context
        </p>
        <h2 id="organisation-context-heading" className="typography-page-title">
          Organisation and first site
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          These details were collected when the organisation was created. Lean
          Excellence Hub will not ask for them again. The organisation is the
          company or group. The site is the operational location you are setting
          up first.
        </p>
      </div>

      <dl
        className="grid gap-5 sm:grid-cols-2"
        data-testid="structure-first-organisation-profile"
      >
        <Detail
          label="Organisation"
          value={facts.organisationName ?? "Not set"}
        />
        <Detail label="Locale" value={facts.organisationLocale ?? "Not set"} />
        <Detail
          label="Time zone"
          value={facts.organisationTimeZone ?? "Not set"}
        />
        <Detail
          label="Reporting currency"
          value={facts.reportingCurrency ?? "Not set"}
        />
        <Detail
          label="Billing plan"
          value={facts.billingPlanName ?? facts.billingPlanCode ?? "Unknown"}
        />
        <Detail
          label="First site"
          value={facts.firstSiteName ?? "Not created yet"}
        />
      </dl>

      <div
        className="rounded-lg border border-border bg-surface px-4 py-3"
        data-testid="structure-first-site-distinction"
      >
        <p className="text-sm text-foreground">
          <span className="font-medium">Organisation</span>
          {facts.organisationName ? ` · ${facts.organisationName}` : null}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Company, business or group. Additional sites can be added to this
          organisation later.
        </p>
        <p className="mt-3 text-sm text-foreground">
          <span className="font-medium">First site</span>
          {facts.firstSiteName ? ` · ${facts.firstSiteName}` : null}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational location already created. It will not be recreated here.
        </p>
        <p className="mt-3 text-sm text-foreground">
          <span className="font-medium">Wider organisation</span>
          {` · ${MULTI_SITE_INTENT_LABELS[resolveMultiSiteIntent(facts.multiSiteIntent)]}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          This is planning context only. It does not buy site capacity or grant
          access.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={pending}
          data-testid="structure-first-continue-context"
        >
          {pending ? "Continuing…" : "Continue to structure"}
        </Button>
      </div>
    </section>
  );
}
