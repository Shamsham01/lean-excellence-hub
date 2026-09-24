import { createCurriculumSuccessorFromForm } from "@/app/(platform)/platform/training/curriculum-actions";
import { AuthoringSaveFeedback } from "@/components/authoring/authoring-save-feedback";
import { CurriculumDraftEditor } from "@/components/training/curriculum-draft-editor";
import { CurriculumRequirementsReadView } from "@/components/training/curriculum-requirements-read-view";
import { TrainingCurriculumScopeNote } from "@/components/training/curriculum-scope-note";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseAuthoringSavedKey } from "@/lib/authoring/authoring-query";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { trainingCurriculumVersionStatusLabel } from "@/modules/training/curriculum-admin";
import {
  resolveTrainingCatalogListResult,
  resolveTrainingCatalogRequiredData,
} from "@/modules/training/resolve-catalog-load";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function mapRequirementLabels(
  requirement: {
    id: string;
    course_id: string;
    applies_to_all_members: boolean;
    job_function_id: string | null;
    organisational_unit_id: string | null;
    mandatory: boolean;
    required_within_days: number | null;
    validity_days_override: number | null;
    grace_period_days: number | null;
    notes: string | null;
  },
  coursesById: Map<string, { name: string }>,
  jobFunctionsById: Map<string, { name: string }>,
  unitsById: Map<string, { name: string }>,
) {
  return {
    id: requirement.id,
    courseId: requirement.course_id,
    courseName: coursesById.get(requirement.course_id)?.name ?? "Course",
    appliesToAllMembers: requirement.applies_to_all_members,
    jobFunctionId: requirement.job_function_id,
    jobFunctionName: requirement.job_function_id
      ? (jobFunctionsById.get(requirement.job_function_id)?.name ?? null)
      : null,
    organisationalUnitId: requirement.organisational_unit_id,
    organisationalUnitName: requirement.organisational_unit_id
      ? (unitsById.get(requirement.organisational_unit_id)?.name ?? null)
      : null,
    mandatory: requirement.mandatory,
    requiredWithinDays: requirement.required_within_days,
    validityDaysOverride: requirement.validity_days_override,
    gracePeriodDays: requirement.grace_period_days,
    notes: requirement.notes,
  };
}

export default async function TrainingCurriculumDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const savedKey = parseAuthoringSavedKey(
    Array.isArray(query.saved) ? query.saved[0] : query.saved,
  );
  const supabase = await createServerSupabaseClient();
  const [canManageCurriculum, { context }] = await Promise.all([
    currentMemberHasPermission(TRAINING_PERMISSIONS.curriculumManage),
    loadActiveSiteContext(),
  ]);

  const curriculum = await resolveTrainingCatalogRequiredData(
    await supabase
      .from("training_curricula")
      .select("id, name, code, description, status")
      .eq("id", id)
      .maybeSingle(),
    "training_curricula",
  );
  const versions = await resolveTrainingCatalogListResult(
    await supabase
      .from("training_curriculum_versions")
      .select("id, version_number, status")
      .eq("curriculum_id", id)
      .order("version_number", { ascending: false }),
    "training_curriculum_versions",
  );

  const draftVersion = versions.find((version) => version.status === "draft");
  const publishedVersion = versions.find(
    (version) => version.status === "published",
  );
  const requirementVersionIds = [draftVersion?.id, publishedVersion?.id].filter(
    (versionId): versionId is string => Boolean(versionId),
  );
  const requirementRows = await resolveTrainingCatalogListResult(
    requirementVersionIds.length > 0
      ? await supabase
          .from("training_requirements")
          .select(
            "id, curriculum_version_id, course_id, job_function_id, organisational_unit_id, applies_to_all_members, mandatory, required_within_days, validity_days_override, grace_period_days, notes",
          )
          .in("curriculum_version_id", requirementVersionIds)
      : { data: [], error: null },
    "training_requirements",
  );

  const [courses, jobFunctions, organisationUnits, courseVersions] =
    await Promise.all([
      resolveTrainingCatalogListResult(
        await supabase
          .from("training_courses")
          .select("id, name, code, status")
          .eq("status", "active")
          .order("name"),
        "training_courses",
      ),
      resolveTrainingCatalogListResult(
        await supabase
          .from("job_functions")
          .select("id, name")
          .eq("status", "active")
          .order("name"),
        "job_functions",
      ),
      resolveTrainingCatalogListResult(
        await supabase
          .from("organisation_units")
          .select("id, name")
          .eq("status", "active")
          .order("name"),
        "organisation_units",
      ),
      resolveTrainingCatalogListResult(
        await supabase
          .from("training_course_versions")
          .select("course_id, status, validity_days")
          .eq("status", "published"),
        "training_course_versions",
      ),
    ]);

  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const jobFunctionsById = new Map(
    jobFunctions.map((jobFunction) => [jobFunction.id, jobFunction]),
  );
  const unitsById = new Map(organisationUnits.map((unit) => [unit.id, unit]));
  const publishedValidityByCourse = new Map(
    courseVersions.map((version) => [version.course_id, version.validity_days]),
  );
  const draftRequirements = requirementRows
    .filter(
      (requirement) => requirement.curriculum_version_id === draftVersion?.id,
    )
    .map((requirement) =>
      mapRequirementLabels(
        requirement,
        coursesById,
        jobFunctionsById,
        unitsById,
      ),
    );
  const publishedRequirements = requirementRows
    .filter(
      (requirement) =>
        requirement.curriculum_version_id === publishedVersion?.id,
    )
    .map((requirement) =>
      mapRequirementLabels(
        requirement,
        coursesById,
        jobFunctionsById,
        unitsById,
      ),
    );

  const hasPublished = Boolean(publishedVersion);
  const hasDraft = Boolean(draftVersion);
  const activeSiteName =
    context.mode === "site"
      ? (context.sites.find((site) => site.id === context.activeSiteId)?.name ??
        null)
      : null;

  return (
    <div
      className="flex flex-col gap-6"
      data-testid="training-curriculum-detail-page"
    >
      <AuthoringSaveFeedback savedKey={savedKey} />
      <PageHeader
        title={curriculum.name}
        description={
          curriculum.description ?? "Organisation training curriculum"
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/training/curriculum"
              data-testid="training-curriculum-detail-back-link"
            >
              Back to curricula
            </AppLink>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span data-testid="training-curriculum-code">{curriculum.code}</span>
        <Badge
          variant={hasPublished ? "success" : "secondary"}
          data-testid="training-curriculum-current-status"
        >
          {hasDraft && hasPublished
            ? "Published · successor draft"
            : hasPublished
              ? "Published"
              : "Draft"}
        </Badge>
      </div>

      {activeSiteName ? (
        <TrainingCurriculumScopeNote siteName={activeSiteName} />
      ) : (
        <p className="text-sm text-muted-foreground">
          This curriculum is organisation-wide. Choosing an organisational unit
          on a requirement records applicability; it does not change the
          organisation-wide curriculum itself.
        </p>
      )}

      {canManageCurriculum && hasPublished && !hasDraft ? (
        <form action={createCurriculumSuccessorFromForm}>
          <input type="hidden" name="curriculumId" value={id} />
          <Button
            type="submit"
            variant="outline"
            className="min-h-11"
            data-testid="create-curriculum-successor"
          >
            Create successor version
          </Button>
        </form>
      ) : null}

      {canManageCurriculum && draftVersion ? (
        <CurriculumDraftEditor
          curriculumId={curriculum.id}
          versionId={draftVersion.id}
          requirements={draftRequirements}
          courses={courses.map((course) => ({
            id: course.id,
            name: course.name,
            validityDays: publishedValidityByCourse.get(course.id) ?? null,
          }))}
          jobFunctions={jobFunctions}
          units={organisationUnits}
        />
      ) : null}

      {publishedVersion ? (
        <Card data-testid="training-curriculum-published-content">
          <CardHeader>
            <CardTitle>
              Published version {publishedVersion.version_number}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <CurriculumRequirementsReadView
              requirements={publishedRequirements}
              emptyMessage="This published curriculum has no requirements."
              testId="training-curriculum-published-requirements"
            />
            <p className="text-muted-foreground">
              Published content is read-only. Create a successor version to
              prepare the next change.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Version history</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {versions.map((version) => (
              <li
                key={version.id}
                className="rounded-md border border-border px-4 py-3"
                data-testid={`training-curriculum-version-${version.version_number}`}
              >
                Version {version.version_number} —{" "}
                {trainingCurriculumVersionStatusLabel(version.status)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
