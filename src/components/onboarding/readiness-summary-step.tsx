"use client";

import { completeStructureFirstOnboarding } from "@/app/onboarding/setup/actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { MODULE_HANDOFF_CARDS } from "@/modules/organisation-onboarding";
import {
  structureFirstStatusLabel,
  type StructureFirstFacts,
  type StructureFirstProgress,
} from "@/modules/organisation-onboarding";

function SummaryRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{value}</p>
      </div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {status}
      </p>
    </div>
  );
}

export function ReadinessSummaryStep({
  facts,
  progress,
  completeError,
}: {
  facts: StructureFirstFacts;
  progress: StructureFirstProgress;
  completeError?: boolean;
}) {
  const organisationStep = progress.steps.find(
    (step) => step.key === "organisation",
  );
  const siteStep = progress.steps.find((step) => step.key === "site");
  const structureStep = progress.steps.find((step) => step.key === "structure");
  const jobStep = progress.steps.find((step) => step.key === "job_functions");
  const peopleStep = progress.steps.find((step) => step.key === "people");

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="structure-first-readiness-step"
      aria-labelledby="readiness-heading"
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Setup readiness
        </p>
        <h2 id="readiness-heading" className="typography-page-title">
          Your organisation foundation is ready
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          LEH now understands enough of your organisation to help configure your
          Operational Excellence system.
        </p>
      </div>

      <div data-testid="structure-first-readiness-summary">
        <SummaryRow
          label="Organisation"
          value={facts.organisationName ?? "Not set"}
          status={structureFirstStatusLabel(
            organisationStep?.status ?? "not_started",
          )}
        />
        <SummaryRow
          label="Site"
          value={facts.firstSiteName ?? "Not set"}
          status={structureFirstStatusLabel(siteStep?.status ?? "not_started")}
        />
        <SummaryRow
          label="Structure"
          value={
            facts.childUnitCount > 0
              ? `${facts.childUnitCount + 1} organisational units`
              : facts.firstSiteName
                ? `Site only · ${facts.firstSiteName}`
                : "Not started"
          }
          status={structureFirstStatusLabel(
            structureStep?.status ?? "not_started",
          )}
        />
        <SummaryRow
          label="Job functions"
          value={
            facts.activeJobFunctionCount > 0
              ? `${facts.activeJobFunctionCount} functions`
              : "Not added yet"
          }
          status={structureFirstStatusLabel(jobStep?.status ?? "not_started")}
        />
        <SummaryRow
          label="People"
          value={`${facts.activeMembershipCount} members · ${facts.pendingInvitationCount} invitations pending`}
          status={structureFirstStatusLabel(
            peopleStep?.status ?? "not_started",
          )}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground">
          Next recommended setup
        </h3>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          These journeys are not started here. Organisational context makes each
          of them more relevant.
        </p>
        <ul
          className="grid gap-3 sm:grid-cols-2"
          data-testid="structure-first-handoff"
        >
          {MODULE_HANDOFF_CARDS.map((card) => (
            <li
              key={card.key}
              className="rounded-lg border border-border bg-surface px-4 py-3"
            >
              <p className="font-medium text-foreground">{card.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{card.why}</p>
            </li>
          ))}
        </ul>
      </div>

      {completeError ? (
        <p className="text-sm text-destructive" role="alert">
          Guided setup could not be completed. Check organisation access and try
          again.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <form action={completeStructureFirstOnboarding}>
          <Button type="submit" data-testid="structure-first-continue-setup">
            Continue setup
          </Button>
        </form>
        <Button variant="outline" asChild>
          <AppLink
            href="/onboarding/setup?step=structure"
            data-testid="structure-first-review-structure"
          >
            Review structure
          </AppLink>
        </Button>
      </div>
    </section>
  );
}
