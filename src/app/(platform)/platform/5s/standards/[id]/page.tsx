import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addFiveSQuestionFromForm,
  addFiveSSectionFromForm,
  createFiveSStandardSuccessorFromForm,
  publishFiveSStandardFromForm,
  startFiveSAuditFromForm,
} from "@/app/(platform)/platform/5s/actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FIVE_S_PERMISSIONS, SCHEDULE_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function FiveSStandardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(FIVE_S_PERMISSIONS.standardsManage);
  const canSchedule = await currentMemberHasPermission(SCHEDULE_PERMISSIONS.manage);

  const { data: standard } = await supabase
    .from("five_s_standards")
    .select("id, display_name, description")
    .eq("id", id)
    .maybeSingle();

  if (!standard) notFound();

  const { data: versions } = await supabase
    .from("five_s_standard_versions")
    .select("id, version_number, status, template_version_id")
    .eq("standard_id", id)
    .order("version_number", { ascending: false });

  const draftVersion = versions?.find((v) => v.status === "draft");
  const publishedVersion = versions?.find((v) => v.status === "published");
  const editorVersion = draftVersion ?? publishedVersion;

  const { data: units } = await supabase
    .from("organisation_units")
    .select("id, name, code")
    .order("name");

  let sections: Array<{ id: string; title: string; position: number }> = [];
  if (editorVersion?.template_version_id) {
    const { data } = await supabase
      .from("template_sections")
      .select("id, title, position")
      .eq("template_version_id", editorVersion.template_version_id)
      .order("position");
    sections = data ?? [];
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={standard.display_name}
        description={standard.description ?? "5S standard configuration"}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            {publishedVersion && !draftVersion && canManage ? (
              <form action={createFiveSStandardSuccessorFromForm}>
                <input type="hidden" name="standardId" value={id} />
                <Button type="submit" variant="outline" className="min-h-11" data-testid="create-successor">
                  Create new version
                </Button>
              </form>
            ) : null}
            {canSchedule && publishedVersion ? (
              <Button variant="outline" className="min-h-11" asChild>
                <Link
                  href={`/platform/schedule/new?activityId=${id}&activityLabel=${encodeURIComponent(standard.display_name)}&returnTo=/platform/5s/standards/${id}`}
                  data-testid="create-schedule-link"
                >
                  Create schedule
                </Link>
              </Button>
            ) : null}
            {publishedVersion ? (
              <form action={startFiveSAuditFromForm}>
                <input type="hidden" name="standardId" value={id} />
                <div className="flex items-end gap-2">
                  <div>
                    <Label htmlFor="unitId">Start audit for unit</Label>
                    <select id="unitId" name="unitId" className="mt-2 min-h-11 rounded-md border border-border bg-background px-3">
                      {units?.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" className="min-h-11">Start audit</Button>
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
            <form action={addFiveSSectionFromForm} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="versionId" value={draftVersion.id} />
              <input type="hidden" name="standardId" value={id} />
              <input type="hidden" name="position" value={sections.length + 1} />
              <div>
                <Label htmlFor="sectionTitle">Category name</Label>
                <Input id="sectionTitle" name="sectionTitle" required className="mt-2 min-h-11" />
              </div>
              <Button type="submit" className="min-h-11">Add category</Button>
            </form>

            {sections.map((section) => (
              <div key={section.id} className="rounded-lg border border-border p-4">
                <p className="font-medium">{section.title}</p>
                <form action={addFiveSQuestionFromForm} className="mt-3 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="versionId" value={draftVersion.id} />
                  <input type="hidden" name="sectionId" value={section.id} />
                  <input type="hidden" name="standardId" value={id} />
                  <div>
                    <Label>Question</Label>
                    <Input name="prompt" required className="mt-2 min-h-11" />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <select name="questionType" className="mt-2 min-h-11 rounded-md border border-border px-3">
                      <option value="yes_no">Yes / No</option>
                      <option value="score">Score</option>
                      <option value="short_text">Text</option>
                    </select>
                  </div>
                  <Button type="submit" className="min-h-11">Add question</Button>
                </form>
              </div>
            ))}

            <form action={publishFiveSStandardFromForm}>
              <input type="hidden" name="versionId" value={draftVersion.id} />
              <input type="hidden" name="standardId" value={id} />
              <Button type="submit" className="min-h-11">Publish standard</Button>
            </form>
          </CardContent>
        </Card>
      ) : publishedVersion ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Published version {publishedVersion.version_number} is active for audits and schedules.{" "}
              <Link href="/platform/5s/history" className="underline">View audit history</Link>
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
