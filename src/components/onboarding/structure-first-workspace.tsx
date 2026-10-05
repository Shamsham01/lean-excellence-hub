"use client";

import type { ReactNode } from "react";

import { JobFunctionsSetupStep } from "@/components/onboarding/job-functions-setup-step";
import { OrganisationContextStep } from "@/components/onboarding/organisation-context-step";
import { PeopleSetupStep } from "@/components/onboarding/people-setup-step";
import { ReadinessSummaryStep } from "@/components/onboarding/readiness-summary-step";
import { StructureFirstProgressNav } from "@/components/onboarding/structure-first-progress";
import { StructureSetupStep } from "@/components/onboarding/structure-setup-step";
import type { DelegatableAccessOffer } from "@/components/people/invite-colleague-form";
import type { StructureFirstSnapshotView } from "@/modules/organisation-onboarding/types";

export function StructureFirstWorkspace({
  snapshot,
  completeError = false,
  coach,
}: {
  snapshot: StructureFirstSnapshotView;
  completeError?: boolean;
  coach?: ReactNode;
}) {
  const { facts, progress, visibleStep, permissions, guidance } = snapshot;
  const stepGuidance = guidance.filter((item) => {
    if (visibleStep === "structure") {
      return (
        item.id === "quality-unit-optional" || item.id === "structure-start"
      );
    }
    if (visibleStep === "job_functions") {
      return (
        item.id === "operator-function-optional" ||
        item.id === "job-functions-start"
      );
    }
    if (visibleStep === "people") {
      return item.id === "people-optional";
    }
    return false;
  });

  return (
    <div className="structure-first-shell" data-testid="onboarding-setup">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:items-start lg:gap-10 lg:py-10">
        <header className="flex flex-col gap-4 lg:sticky lg:top-8">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Lean Excellence Hub
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Organisation setup
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              LEH is learning how your organisation works — not completing a
              generic checklist.
            </p>
          </div>
          <StructureFirstProgressNav
            progress={progress}
            currentStep={visibleStep}
          />
          {coach}
          {permissions.canAskLeanAi ? (
            <p className="text-xs text-muted-foreground">
              LeanAI can explain setup guidance when you choose Explain. It will
              not change configuration for you.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Deterministic guidance is shown in each step. LeanAI is advisory
              and never required to continue.
            </p>
          )}
        </header>

        <main className="structure-first-step-enter min-w-0 pb-16">
          {visibleStep === "organisation" || visibleStep === "site" ? (
            <OrganisationContextStep facts={facts} />
          ) : null}
          {visibleStep === "structure" ? (
            <StructureSetupStep
              factsSiteName={facts.firstSiteName}
              firstSiteId={facts.firstSiteId}
              tree={snapshot.tree}
              units={snapshot.units}
              canManage={permissions.canManageHierarchy}
              guidance={stepGuidance}
            />
          ) : null}
          {visibleStep === "job_functions" ? (
            <JobFunctionsSetupStep
              jobFunctions={snapshot.jobFunctions}
              canManage={permissions.canManageJobFunctions}
              guidance={stepGuidance}
            />
          ) : null}
          {visibleStep === "people" ? (
            <PeopleSetupStep
              owners={snapshot.owners}
              members={snapshot.members}
              pendingInvitations={snapshot.pendingInvitations}
              offers={snapshot.offers as DelegatableAccessOffer[]}
              units={snapshot.units
                .filter((unit) => unit.status !== "retired")
                .map((unit) => ({
                  id: unit.id,
                  name: unit.name,
                  code: unit.code,
                  parent_unit_id: unit.parent_unit_id ?? null,
                }))}
              jobFunctions={snapshot.jobFunctions}
              canInvite={
                permissions.canManageInvitations && permissions.canDelegateRoles
              }
              guidance={stepGuidance}
            />
          ) : null}
          {visibleStep === "readiness" ? (
            <ReadinessSummaryStep
              facts={facts}
              progress={progress}
              completeError={completeError}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
