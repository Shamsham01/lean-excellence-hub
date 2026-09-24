import { CurriculumCreateForm } from "@/components/training/curriculum-create-form";
import { TrainingCurriculumScopeNote } from "@/components/training/curriculum-scope-note";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import { loadActiveSiteContext } from "@/modules/organisation/site-context-server";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import {
  deriveTrainingCurriculumCatalogueStatus,
  trainingCurriculumCatalogueStatusLabel,
} from "@/modules/training/curriculum-admin";
import { resolveTrainingCatalogListResult } from "@/modules/training/resolve-catalog-load";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TrainingCurriculaPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const newRequested = Array.isArray(query.new) ? query.new[0] : query.new;
  const supabase = await createServerSupabaseClient();
  const [canManageCurriculum, { context }] = await Promise.all([
    currentMemberHasPermission(TRAINING_PERMISSIONS.curriculumManage),
    loadActiveSiteContext(),
  ]);

  const curricula = await resolveTrainingCatalogListResult(
    await supabase
      .from("training_curricula")
      .select("id, name, code, description, status")
      .order("name"),
    "training_curricula",
  );

  const curriculumIds = curricula.map((curriculum) => curriculum.id);
  const versions = await resolveTrainingCatalogListResult(
    curriculumIds.length > 0
      ? await supabase
          .from("training_curriculum_versions")
          .select("curriculum_id, status")
          .in("curriculum_id", curriculumIds)
      : { data: [], error: null },
    "training_curriculum_versions",
  );

  const versionsByCurriculum = new Map<string, string[]>();
  for (const version of versions) {
    const existing = versionsByCurriculum.get(version.curriculum_id) ?? [];
    existing.push(version.status);
    versionsByCurriculum.set(version.curriculum_id, existing);
  }

  const isEmpty = curricula.length === 0;
  const showCreateForm =
    canManageCurriculum && (isEmpty || newRequested === "1");
  const activeSiteName =
    context.mode === "site"
      ? (context.sites.find((site) => site.id === context.activeSiteId)?.name ??
        null)
      : null;

  return (
    <div className="flex flex-col gap-8" data-testid="training-curriculum-page">
      <PageHeader
        title="Training curricula"
        description="Organisation-wide training requirements that say who needs which courses and when."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageCurriculum && !showCreateForm ? (
              <Button size="sm" asChild>
                <AppLink
                  href="/platform/training/curriculum?new=1"
                  data-testid="training-curriculum-new-button"
                >
                  New curriculum
                </AppLink>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <AppLink
                href="/platform/training"
                data-testid="training-curriculum-back-link"
              >
                Back to training
              </AppLink>
            </Button>
          </div>
        }
      />

      {activeSiteName ? (
        <TrainingCurriculumScopeNote siteName={activeSiteName} />
      ) : (
        <p className="text-sm text-muted-foreground">
          These curricula are shared across the organisation.
        </p>
      )}

      {canManageCurriculum && showCreateForm ? (
        <CurriculumCreateForm
          existingCodes={curricula.map((curriculum) => curriculum.code)}
          cancelHref="/platform/training/curriculum"
        />
      ) : null}

      {isEmpty && !showCreateForm ? (
        <Card
          className="border-dashed bg-surface"
          data-testid="training-curricula-empty"
        >
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex max-w-md flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-foreground">
                No training curricula yet
              </h2>
              <p className="text-sm text-muted-foreground">
                The organisation has not published a training curriculum yet.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isEmpty && showCreateForm ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="training-curricula-empty"
        >
          Create the first curriculum to define who needs which courses. You can
          add requirements, then publish when it is ready.
        </p>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {curricula.map((curriculum) => {
              const status = deriveTrainingCurriculumCatalogueStatus({
                curriculumStatus: curriculum.status,
                versionStatuses: versionsByCurriculum.get(curriculum.id) ?? [],
              });
              const statusLabel =
                trainingCurriculumCatalogueStatusLabel(status);

              return (
                <AppLink
                  key={curriculum.id}
                  href={`/platform/training/curriculum/${curriculum.id}`}
                  className="flex min-h-11 flex-col gap-2 px-4 py-3 hover:bg-surface sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`training-curriculum-link-${curriculum.id}`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{curriculum.name}</span>
                    {curriculum.description ? (
                      <span className="text-sm text-muted-foreground">
                        {curriculum.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{curriculum.code}</span>
                    <Badge
                      variant={
                        status === "published" ||
                        status === "published_with_draft"
                          ? "success"
                          : "secondary"
                      }
                      data-testid={`training-curriculum-status-${curriculum.id}`}
                    >
                      {statusLabel}
                    </Badge>
                  </span>
                </AppLink>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
