import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { requireClaims } from "@/modules/identity/session";
import { pathForOrganisationStatus } from "@/modules/organisations/access-path";
import {
  listEligibleOrganisations,
  loadCurrentOrganisationId,
  switchOrganisation,
} from "@/modules/organisations/context";
import { redirect } from "next/navigation";

import { completeOrganisationOnboarding } from "../actions";

const STEPS = [
  {
    title: "Organisation and first site",
    body: "Your organisation, locale, and first site are already created. You can refine structure from Settings after launch.",
  },
  {
    title: "Invite your team",
    body: "Invite colleagues from Settings → People when you are ready. This step is skippable.",
  },
  {
    title: "Setup approach",
    body: "Start from scratch, use a starter template, import existing configuration, or use Lean AI later. None of these block access.",
  },
  {
    title: "Module guidance",
    body: "Assess → Improve → Develop → Prove. Organisation setup lists the empty-state path for each module.",
  },
] as const;

export default async function OnboardingSetupPage() {
  await requireClaims();
  let organisationId = await loadCurrentOrganisationId();
  if (!organisationId) {
    const organisations = await listEligibleOrganisations();
    if (organisations.length === 1) {
      await switchOrganisation(organisations[0]!.organisation_id);
      organisationId = organisations[0]!.organisation_id;
    } else {
      redirect("/select-organisation");
    }
  }

  const organisations = await listEligibleOrganisations();
  const current = organisations.find(
    (organisation) => organisation.organisation_id === organisationId,
  );
  if (!current) {
    redirect("/select-organisation");
  }

  const accessPath = pathForOrganisationStatus(
    current.organisation_status,
    current.onboarding_required,
  );
  if (accessPath !== "/onboarding/setup") {
    redirect(accessPath);
  }

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
      data-testid="onboarding-setup"
    >
      <div className="w-full max-w-lg">
        <AuthCard
          title="Set up Lean Excellence Hub"
          description={`${current.organisation_name} is active. This wizard is skippable and does not replace operational setup.`}
        >
          <ol className="grid gap-3 text-sm">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-md border border-border p-3"
              >
                <p className="font-medium">
                  {index + 1}. {step.title}
                </p>
                <p className="text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <form action={completeOrganisationOnboarding}>
            <Button type="submit" className="w-full">
              Finish and enter workspace
            </Button>
          </form>
        </AuthCard>
      </div>
    </div>
  );
}
