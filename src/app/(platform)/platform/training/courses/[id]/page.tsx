import { notFound } from "next/navigation";

import {
  createCourseSuccessorFromForm,
  publishTrainingCourseFromForm,
  updateTrainingCourseDraftFromForm,
} from "@/app/(platform)/platform/training/actions";
import { AuthoringSaveFeedback } from "@/components/authoring/authoring-save-feedback";
import { OrganisationCatalogueScopeNotice } from "@/components/training/organisation-catalogue-scope-notice";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseAuthoringSavedKey } from "@/lib/authoring/authoring-query";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  formatTrainingCourseVersionStatus,
  formatTrainingDeliveryMethod,
  TRAINING_DELIVERY_METHODS,
  trainingCoursePublishReadiness,
} from "@/modules/training/catalog-admin";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TrainingCourseDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const savedKey = parseAuthoringSavedKey(
    Array.isArray(query.saved) ? query.saved[0] : query.saved,
  );
  const supabase = await createServerSupabaseClient();
  const [{ context }, canManageCatalog] = await Promise.all([
    loadActiveSiteContext(),
    currentMemberHasPermission(TRAINING_PERMISSIONS.catalogManage),
  ]);

  const { data: course } = await supabase
    .from("training_courses")
    .select("id, name, code, description, category")
    .eq("id", id)
    .maybeSingle();

  if (!course) notFound();

  const { data: versions } = await supabase
    .from("training_course_versions")
    .select(
      "id, version_number, status, validity_days, duration_minutes, delivery_method, learning_objectives, trainer_requirements",
    )
    .eq("course_id", id)
    .order("version_number", { ascending: false });

  const draftVersion = versions?.find((version) => version.status === "draft");
  const publishedVersion = versions?.find(
    (version) => version.status === "published",
  );
  const publishReadiness = draftVersion
    ? trainingCoursePublishReadiness({
        validityDays: draftVersion.validity_days,
        durationMinutes: draftVersion.duration_minutes,
        deliveryMethod: draftVersion.delivery_method,
        learningObjectives: draftVersion.learning_objectives,
      })
    : null;

  return (
    <div
      className="flex flex-col gap-6"
      data-testid="training-course-detail-page"
    >
      <AuthoringSaveFeedback savedKey={savedKey} />
      <PageHeader
        title={course.name}
        description={course.description ?? course.code}
        actions={
          <Button variant="outline" size="sm" asChild>
            <AppLink
              href="/platform/training/courses"
              data-testid="training-course-back-link"
            >
              Back to courses
            </AppLink>
          </Button>
        }
      />

      <OrganisationCatalogueScopeNotice context={context} />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Code: {course.code}</span>
        {course.category ? <span>· {course.category}</span> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {versions?.map((version) => (
          <Badge key={version.id} variant="outline">
            v{version.version_number} ·{" "}
            {formatTrainingCourseVersionStatus(
              version.status as "draft" | "published" | "archived",
            )}
          </Badge>
        ))}
      </div>

      {canManageCatalog && publishedVersion && !draftVersion ? (
        <form action={createCourseSuccessorFromForm}>
          <input type="hidden" name="courseId" value={id} />
          <Button
            type="submit"
            variant="outline"
            className="min-h-11"
            data-testid="create-course-successor"
          >
            Create successor version
          </Button>
        </form>
      ) : null}

      {draftVersion && canManageCatalog ? (
        <Card>
          <CardHeader>
            <CardTitle>Draft version {draftVersion.version_number}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">
              Edit the draft below. Published content stays read-only until you
              create a successor version.
            </p>
            <form
              action={updateTrainingCourseDraftFromForm}
              className="flex max-w-2xl flex-col gap-4"
            >
              <input type="hidden" name="courseId" value={id} />
              <input type="hidden" name="versionId" value={draftVersion.id} />
              <div>
                <Label htmlFor="validityDays">
                  Qualification validity (days)
                </Label>
                <Input
                  id="validityDays"
                  name="validityDays"
                  type="number"
                  min={1}
                  defaultValue={draftVersion.validity_days ?? ""}
                  placeholder="365"
                  className="mt-2 min-h-11"
                  data-testid="training-course-validity-input"
                />
              </div>
              <div>
                <Label htmlFor="durationMinutes">
                  Estimated duration (minutes)
                </Label>
                <Input
                  id="durationMinutes"
                  name="durationMinutes"
                  type="number"
                  min={1}
                  defaultValue={draftVersion.duration_minutes ?? ""}
                  placeholder="240"
                  className="mt-2 min-h-11"
                  data-testid="training-course-duration-input"
                />
              </div>
              <div>
                <Label htmlFor="deliveryMethod">Delivery method</Label>
                <select
                  id="deliveryMethod"
                  name="deliveryMethod"
                  defaultValue={draftVersion.delivery_method ?? ""}
                  className="mt-2 min-h-11 w-full rounded-md border border-border px-3"
                  data-testid="training-course-delivery-select"
                >
                  <option value="">Select a delivery method</option>
                  {TRAINING_DELIVERY_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="learningObjectives">Learning objectives</Label>
                <Textarea
                  id="learningObjectives"
                  name="learningObjectives"
                  rows={4}
                  defaultValue={draftVersion.learning_objectives ?? ""}
                  className="mt-2"
                  data-testid="training-course-objectives-input"
                />
              </div>
              <div>
                <Label htmlFor="trainerRequirements">
                  Trainer requirements (optional)
                </Label>
                <Textarea
                  id="trainerRequirements"
                  name="trainerRequirements"
                  rows={3}
                  defaultValue={draftVersion.trainer_requirements ?? ""}
                  className="mt-2"
                  data-testid="training-course-trainer-input"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="min-h-11"
                data-testid="training-course-save-draft"
              >
                Save draft details
              </Button>
            </form>

            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-semibold">Publish course</h3>
              {publishReadiness?.recommendations.length ? (
                <ul
                  className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground"
                  data-testid="training-course-publish-recommendations"
                >
                  {publishReadiness.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  This draft is ready to publish. Publishing makes the course
                  available organisation-wide in the training catalogue.
                </p>
              )}
              <form action={publishTrainingCourseFromForm} className="mt-4">
                <input type="hidden" name="courseId" value={id} />
                <input type="hidden" name="versionId" value={draftVersion.id} />
                <Button
                  type="submit"
                  className="min-h-11"
                  data-testid="training-course-publish"
                >
                  Publish course
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {publishedVersion ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Published version {publishedVersion.version_number}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              This version is active in the organisation training catalogue.
            </p>
            <p>
              <span className="text-muted-foreground">Validity:</span>{" "}
              {publishedVersion.validity_days
                ? `${publishedVersion.validity_days} days`
                : "Not set"}
            </p>
            <p>
              <span className="text-muted-foreground">Duration:</span>{" "}
              {publishedVersion.duration_minutes
                ? `${publishedVersion.duration_minutes} minutes`
                : "Not set"}
            </p>
            <p>
              <span className="text-muted-foreground">Delivery:</span>{" "}
              {formatTrainingDeliveryMethod(publishedVersion.delivery_method)}
            </p>
            {publishedVersion.learning_objectives ? (
              <div>
                <p className="text-muted-foreground">Learning objectives</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {publishedVersion.learning_objectives}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!canManageCatalog && !draftVersion && !publishedVersion ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            This course has no published version yet.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
