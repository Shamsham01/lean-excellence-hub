import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import {
  nextSkillsSetupHref,
  skillsFrameworkIsUnconfigured,
  skillsSetupStepNeeds,
  type SkillsSetupSnapshot,
} from "@/modules/skills/setup-path";

export function SkillsFrameworkPath({
  snapshot,
  canManageCatalog,
  canManageRequirements,
}: {
  snapshot: SkillsSetupSnapshot;
  canManageCatalog: boolean;
  canManageRequirements: boolean;
}) {
  const unconfigured = skillsFrameworkIsUnconfigured(snapshot);
  const nextHref = nextSkillsSetupHref(snapshot);
  const nextNeeds = skillsSetupStepNeeds(nextHref);
  const canTakeNext =
    nextNeeds === "read" ||
    (nextNeeds === "catalog" && canManageCatalog) ||
    (nextNeeds === "requirements" && canManageRequirements);

  const scaleStatus =
    snapshot.publishedScaleCount > 0
      ? "Published"
      : snapshot.draftScaleId
        ? "Draft"
        : "Not started";
  const catalogueStatus =
    snapshot.activeSkillCount > 0
      ? `${snapshot.activeSkillCount} active`
      : "No skills";
  const requirementsStatus =
    snapshot.publishedStandardCount > 0
      ? "Published"
      : snapshot.draftStandardId
        ? "Draft"
        : "Not started";
  const matrixStatus =
    snapshot.publishedStandardCount > 0
      ? "Ready to compare"
      : "Waiting for a published standard";

  const steps = [
    {
      id: "scales",
      title: "Proficiency scales",
      description: "Define how capability is measured.",
      status: scaleStatus,
      href: snapshot.draftScaleId
        ? `/platform/skills/scales/${snapshot.draftScaleId}`
        : "/platform/skills/scales",
      testId: "skills-setup-scales",
    },
    {
      id: "catalogue",
      title: "Skills catalogue",
      description: "Define the capabilities people need.",
      status: catalogueStatus,
      href: "/platform/skills/catalog",
      testId: "skills-setup-catalogue",
    },
    {
      id: "requirements",
      title: "Capability requirements",
      description: "Connect skills and target levels to job functions.",
      status: requirementsStatus,
      href: snapshot.draftStandardId
        ? `/platform/skills/standards/${snapshot.draftStandardId}`
        : "/platform/skills/standards",
      testId: "skills-setup-requirements",
    },
    {
      id: "matrix",
      title: "Skills matrix",
      description: "Compare requirements with current validated capability.",
      status: matrixStatus,
      href: "/platform/skills/matrix",
      testId: "skills-setup-matrix",
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      {unconfigured ? (
        <section
          className="flex max-w-2xl flex-col gap-4"
          data-testid="skills-empty-state"
        >
          <h2 className="text-xl font-semibold tracking-tight">
            Build your skills framework
          </h2>
          <p className="text-sm text-muted-foreground">
            Define the skills your organisation needs, how proficiency is
            measured, and which job functions require each capability.
          </p>
          {canTakeNext || canManageCatalog ? (
            <div className="flex flex-wrap gap-2">
              {canTakeNext ? (
                <Button asChild>
                  <AppLink href={nextHref} data-testid="skills-setup-primary">
                    Set up skills
                  </AppLink>
                </Button>
              ) : null}
              {canManageCatalog ? (
                <Button variant="outline" asChild>
                  <AppLink
                    href="/platform/skills/catalog?new=1"
                    data-testid="skills-setup-create-skill"
                  >
                    Create skill
                  </AppLink>
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You can view Skills. Catalogue and requirement setup need the
              matching permissions.
            </p>
          )}
        </section>
      ) : canTakeNext ? (
        <div>
          <Button asChild>
            <AppLink href={nextHref} data-testid="skills-setup-primary">
              {nextHref.includes("/matrix")
                ? "Open skills matrix"
                : "Continue setup"}
            </AppLink>
          </Button>
        </div>
      ) : null}

      <ol className="flex flex-col">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3"
            data-testid={step.testId}
          >
            <div className="flex flex-col items-center">
              <span className="flex size-8 items-center justify-center rounded-full border border-border text-sm font-medium">
                {index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span className="my-1 w-px flex-1 bg-border" aria-hidden />
              ) : null}
            </div>
            <div className="min-w-0 pb-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-base font-medium">
                  <AppLink href={step.href} className="hover:underline">
                    {step.title}
                  </AppLink>
                </h2>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {step.status}
                </p>
              </div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
