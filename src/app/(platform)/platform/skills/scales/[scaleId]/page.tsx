import { notFound } from "next/navigation";

import { ScaleDraftPanel } from "@/components/skills/scale-draft-panel";
import { VersionStatusBadge } from "@/components/skills/version-status-badge";
import { PageHeader } from "@/components/platform/page-header";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { createServerSupabaseClient } from "@/platform/supabase/server";

type PageProps = { params: Promise<{ scaleId: string }> };

export default async function ProficiencyScalePage({ params }: PageProps) {
  const { scaleId } = await params;
  const supabase = await createServerSupabaseClient();
  const canManageCatalog = await currentMemberHasPermission(
    SKILLS_PERMISSIONS.catalogManage,
  );
  const { data: scale } = await supabase
    .from("skill_proficiency_scales")
    .select("id, name, description")
    .eq("id", scaleId)
    .maybeSingle();

  if (!scale) {
    notFound();
  }

  const { data: versions } = await supabase
    .from("skill_proficiency_scale_versions")
    .select("id, status, version_number, created_at")
    .eq("scale_id", scaleId)
    .order("version_number", { ascending: false });

  const current = versions?.[0];
  if (!current) {
    notFound();
  }

  const { data: levels } = await supabase
    .from("skill_proficiency_levels")
    .select("id, order_value, label, description, guidance")
    .eq("scale_version_id", current.id)
    .order("order_value");

  const isDraft = current.status === "draft";

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="scale-detail-page"
    >
      <PageHeader
        title={scale.name}
        description={scale.description ?? "Proficiency scale"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span data-testid="scale-status">
              <VersionStatusBadge status={current.status} />
            </span>
            <Button variant="outline" size="sm" asChild>
              <AppLink href="/platform/skills/scales">All scales</AppLink>
            </Button>
          </div>
        }
      />

      {isDraft && canManageCatalog ? (
        <ScaleDraftPanel
          versionId={current.id}
          scaleName={scale.name}
          levels={(levels ?? []).map((level) => ({
            id: level.id,
            order: level.order_value,
            label: level.label,
            description: level.description,
            guidance: level.guidance,
          }))}
        />
      ) : (
        <section className="flex max-w-2xl flex-col gap-4">
          <p
            className="text-sm text-muted-foreground"
            data-testid="scale-readonly-note"
          >
            {current.status === "published"
              ? "This scale is published and read-only. Changing it in place is not available. A later version can be added when scale versioning is supported."
              : "This scale version is read-only."}
          </p>
          <ol className="flex flex-col gap-3" data-testid="scale-saved-levels">
            {(levels ?? []).map((level) => (
              <li key={level.id} className="border-t border-border pt-3">
                <p className="text-sm font-medium">
                  {level.order_value} — {level.label}
                </p>
                {level.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {level.description}
                  </p>
                ) : null}
                {level.guidance ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Guidance: {level.guidance}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
