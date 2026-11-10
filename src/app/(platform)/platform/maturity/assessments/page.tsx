import { StartAssessmentDialog } from "@/components/maturity/start-assessment-dialog";
import { PageHeader } from "@/components/platform/page-header";
import { loadStartAssessmentDialogProps } from "@/lib/maturity/load-start-assessment-props";
import { MATURITY_PERMISSIONS } from "@/modules/maturity/scoring";
import { AssessmentStatusBadge } from "@/modules/maturity/status-badges";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";
import { AppLink } from "@/components/ui/app-link";

export default async function AssessmentsListPage() {
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: MATURITY_PERMISSIONS.read,
    module: "maturity",
    title: "Maturity",
    denyWithoutAccess: false,
  });
  if (workplaceView) return workplaceView;

  const supabase = await createServerSupabaseClient();
  const [canAssessFormal, canAssessSelf] = await Promise.all([
    currentMemberHasPermission(MATURITY_PERMISSIONS.assessFormal),
    currentMemberHasPermission(MATURITY_PERMISSIONS.assessSelf),
  ]);
  const canStart = canAssessFormal || canAssessSelf;
  const startAssessmentProps = canStart
    ? await loadStartAssessmentDialogProps()
    : null;
  const { data: assessments } = await supabase
    .from("maturity_assessments")
    .select("id, status, assessment_type, updated_at, unit_id")
    .order("updated_at", { ascending: false });

  const unitIds = [
    ...new Set((assessments ?? []).map((assessment) => assessment.unit_id)),
  ];
  const unitNameById: Record<string, string> = {};

  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from("organisation_units")
      .select("id, name")
      .in("id", unitIds);

    for (const unit of units ?? []) {
      unitNameById[unit.id] = unit.name;
    }
  }

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="maturity-assessments-page"
    >
      <PageHeader
        title="Assessments"
        actions={
          startAssessmentProps ? (
            <StartAssessmentDialog
              {...startAssessmentProps}
              triggerTestId="maturity-start-assessment-link"
            />
          ) : null
        }
      />

      <div className="flex flex-col gap-2">
        {assessments?.map((a) => (
          <AppLink
            key={a.id}
            href={`/platform/maturity/assessments/${a.id}`}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted"
            data-testid={`maturity-assessment-item-${a.id}`}
          >
            <div>
              <p className="text-sm font-medium capitalize">
                {a.assessment_type.replace("_", " ")} assessment
              </p>
              <p className="typography-metadata">
                {unitNameById[a.unit_id] ?? "Unknown unit"} · Updated{" "}
                {new Date(a.updated_at).toLocaleDateString("en-GB")}
              </p>
            </div>
            <AssessmentStatusBadge status={a.status} />
          </AppLink>
        ))}
      </div>
    </div>
  );
}
