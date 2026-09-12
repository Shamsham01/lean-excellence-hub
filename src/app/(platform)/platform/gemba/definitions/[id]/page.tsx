import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addGembaQuestionFromForm,
  addGembaSectionFromForm,
  createGembaDefinitionSuccessorFromForm,
  publishGembaDefinitionFromForm,
  startGembaWalkFromForm,
} from "@/app/(platform)/platform/gemba/actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  GEMBA_PERMISSIONS,
  SCHEDULE_PERMISSIONS,
} from "@/modules/operational/permissions";
import {
  isTemplateAuthoringPublishReady,
  loadTemplateAuthoringChildren,
} from "@/modules/operational/template-authoring";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function GembaDefinitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(
    GEMBA_PERMISSIONS.definitionsManage,
  );
  const canSchedule = await currentMemberHasPermission(
    SCHEDULE_PERMISSIONS.manage,
  );

  const { data: definition } = await supabase
    .from("gemba_definitions")
    .select("id, display_name, description")
    .eq("id", id)
    .maybeSingle();
  if (!definition) notFound();

  const { data: versions } = await supabase
    .from("gemba_definition_versions")
    .select("id, version_number, status, template_version_id")
    .eq("definition_id", id)
    .order("version_number", { ascending: false });

  const draftVersion = versions?.find((v) => v.status === "draft");
  const publishedVersion = versions?.find((v) => v.status === "published");
  const editorVersion = draftVersion ?? publishedVersion;

  const { data: units } = await supabase
    .from("organisation_units")
    .select("id, name")
    .order("name");

  const authoring = await loadTemplateAuthoringChildren(
    supabase,
    editorVersion?.template_version_id,
  );
  const canPublish = isTemplateAuthoringPublishReady(authoring);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={definition.display_name}
        description={definition.description ?? "Gemba definition"}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            {publishedVersion && !draftVersion && canManage ? (
              <form action={createGembaDefinitionSuccessorFromForm}>
                <input type="hidden" name="definitionId" value={id} />
                <Button type="submit" variant="outline" className="min-h-11">
                  Create new version
                </Button>
              </form>
            ) : null}
            {canSchedule && publishedVersion ? (
              <Button variant="outline" className="min-h-11" asChild>
                <Link
                  href={`/platform/schedule/new?activityId=${id}&activityLabel=${encodeURIComponent(definition.display_name)}&returnTo=/platform/gemba/definitions/${id}`}
                  data-testid="create-schedule-link"
                >
                  Create schedule
                </Link>
              </Button>
            ) : null}
            {publishedVersion ? (
              <form action={startGembaWalkFromForm}>
                <input type="hidden" name="definitionId" value={id} />
                <div className="flex items-end gap-2">
                  <select
                    name="unitId"
                    className="min-h-11 rounded-md border border-border px-3"
                  >
                    {units?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" className="min-h-11">
                    Start walk
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {versions?.map((version) => (
          <Badge key={version.id} variant="outline">
            v{version.version_number} · {version.status}
          </Badge>
        ))}
      </div>

      {draftVersion ? (
        <Card>
          <CardHeader>
            <CardTitle>Draft v{draftVersion.version_number}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <form
              action={addGembaSectionFromForm}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="versionId" value={draftVersion.id} />
              <input type="hidden" name="definitionId" value={id} />
              <div>
                <Label htmlFor="sectionTitle">Section title</Label>
                <Input
                  id="sectionTitle"
                  name="sectionTitle"
                  required
                  className="mt-2 min-h-11"
                  data-testid="gemba-section-title"
                />
              </div>
              <Button type="submit" className="min-h-11">
                Add section
              </Button>
            </form>

            {authoring.sections.map((section) => (
              <div
                key={section.id}
                className="rounded-lg border border-border p-4"
                data-testid="authoring-section"
              >
                <p className="font-medium">{section.title}</p>
                {section.questions.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {section.questions.map((question) => (
                      <li
                        key={question.id}
                        className="rounded-md border border-border bg-surface px-3 py-2"
                        data-testid="authoring-question"
                      >
                        <p className="font-medium">{question.prompt}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No walk prompts in this section yet.
                  </p>
                )}
                <form
                  action={addGembaQuestionFromForm}
                  className="mt-3 flex flex-wrap items-end gap-3"
                >
                  <input
                    type="hidden"
                    name="versionId"
                    value={draftVersion.id}
                  />
                  <input type="hidden" name="sectionId" value={section.id} />
                  <input type="hidden" name="definitionId" value={id} />
                  <div>
                    <Label htmlFor={`prompt-${section.id}`}>Walk prompt</Label>
                    <Input
                      id={`prompt-${section.id}`}
                      name="prompt"
                      required
                      className="mt-2 min-h-11"
                      data-testid="gemba-question-prompt"
                    />
                  </div>
                  <Button type="submit" className="min-h-11">
                    Add prompt
                  </Button>
                </form>
              </div>
            ))}

            <form action={publishGembaDefinitionFromForm}>
              <input type="hidden" name="versionId" value={draftVersion.id} />
              <input type="hidden" name="definitionId" value={id} />
              {!canPublish ? (
                <p
                  className="mb-3 text-sm text-muted-foreground"
                  data-testid="publish-blocked-reason"
                >
                  Add at least one walk prompt before publishing this
                  definition.
                </p>
              ) : null}
              <Button
                type="submit"
                className="min-h-11"
                disabled={!canPublish}
                data-testid="publish-gemba-definition"
              >
                Publish definition
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : publishedVersion ? (
        <Card>
          <CardContent className="py-6">
            <Link href="/platform/gemba/history" className="text-sm underline">
              View walk history
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
