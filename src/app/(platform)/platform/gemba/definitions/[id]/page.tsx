import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addGembaSectionFromForm,
  createGembaDefinitionSuccessorFromForm,
  publishGembaDefinitionFromForm,
  startGembaWalkFromForm,
} from "@/app/(platform)/platform/gemba/actions";
import { PageHeader } from "@/components/platform/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GEMBA_PERMISSIONS, SCHEDULE_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function GembaDefinitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const canManage = await currentMemberHasPermission(GEMBA_PERMISSIONS.definitionsManage);
  const canSchedule = await currentMemberHasPermission(SCHEDULE_PERMISSIONS.manage);

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

  const { data: units } = await supabase.from("organisation_units").select("id, name").order("name");

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
                >
                  Create schedule
                </Link>
              </Button>
            ) : null}
            {publishedVersion ? (
              <form action={startGembaWalkFromForm}>
                <input type="hidden" name="definitionId" value={id} />
                <div className="flex items-end gap-2">
                  <select name="unitId" className="min-h-11 rounded-md border border-border px-3">
                    {units?.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <Button type="submit" className="min-h-11">Start walk</Button>
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
          <CardHeader><CardTitle>Draft v{draftVersion.version_number}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={addGembaSectionFromForm} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="versionId" value={draftVersion.id} />
              <input type="hidden" name="definitionId" value={id} />
              <input type="hidden" name="position" value={1} />
              <Input name="sectionTitle" placeholder="Section title" required className="min-h-11" />
              <Button type="submit" className="min-h-11">Add section</Button>
            </form>
            <form action={publishGembaDefinitionFromForm}>
              <input type="hidden" name="versionId" value={draftVersion.id} />
              <input type="hidden" name="definitionId" value={id} />
              <Button type="submit" className="min-h-11">Publish definition</Button>
            </form>
          </CardContent>
        </Card>
      ) : publishedVersion ? (
        <Card>
          <CardContent className="py-6">
            <Link href="/platform/gemba/history" className="text-sm underline">View walk history</Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
