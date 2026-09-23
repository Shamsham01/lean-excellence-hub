import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { describeTrainingRequirementApplicability } from "@/modules/training/curriculum-admin";

export type CurriculumReadRequirement = {
  id: string;
  courseId: string;
  courseName: string;
  appliesToAllMembers: boolean;
  jobFunctionName: string | null;
  organisationalUnitName: string | null;
  mandatory: boolean;
  requiredWithinDays: number | null;
  validityDaysOverride: number | null;
  gracePeriodDays: number | null;
  notes: string | null;
};

export function CurriculumRequirementsReadView({
  requirements,
  emptyMessage,
  testId,
}: {
  requirements: readonly CurriculumReadRequirement[];
  emptyMessage: string;
  testId: string;
}) {
  if (requirements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid={testId}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-3" data-testid={testId}>
      {requirements.map((requirement) => (
        <li
          key={requirement.id}
          className="rounded-md border border-border px-4 py-3"
          data-testid={`training-curriculum-requirement-${requirement.id}`}
        >
          <p className="font-medium">
            <AppLink
              href={`/platform/training/courses/${requirement.courseId}`}
              className="hover:underline"
              data-testid={`training-curriculum-course-link-${requirement.courseId}`}
            >
              {requirement.courseName}
            </AppLink>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {describeTrainingRequirementApplicability({
              appliesToAllMembers: requirement.appliesToAllMembers,
              jobFunctionName: requirement.jobFunctionName,
              organisationalUnitName: requirement.organisationalUnitName,
            })}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={requirement.mandatory ? "success" : "secondary"}>
              {requirement.mandatory ? "Mandatory" : "Optional"}
            </Badge>
            {requirement.requiredWithinDays != null ? (
              <span>Complete within {requirement.requiredWithinDays} days</span>
            ) : null}
            {requirement.validityDaysOverride != null ? (
              <span>
                Validity override {requirement.validityDaysOverride} days
              </span>
            ) : null}
            {requirement.gracePeriodDays != null ? (
              <span>Grace period {requirement.gracePeriodDays} days</span>
            ) : null}
            {requirement.notes ? <span>{requirement.notes}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
