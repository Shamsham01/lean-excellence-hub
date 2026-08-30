import Link from "next/link";

import { PageHeader } from "@/components/platform/page-header";

import { ProgrammeManagement } from "@/components/suggestions/programme-management";

import { Button } from "@/components/ui/button";

import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function SuggestionProgrammesPage() {
  const supabase = await createServerSupabaseClient();

  const canManage = await currentMemberHasPermission(
    "suggestions.programmes.manage",
  );

  if (!canManage) {
    return (
      <div className="text-sm text-muted-foreground">
        Programme management is not available for your role.
      </div>
    );
  }

  const { data: programmes } = await supabase

    .from("suggestion_programmes")

    .select("id, name, code, description, status")

    .order("name");

  const { data: versions } = await supabase

    .from("suggestion_programme_versions")

    .select(
      "id, programme_id, version_number, lifecycle, review_target_days, submission_guidance, template_version_id",
    )

    .order("version_number", { ascending: false });

  const { data: categories } = await supabase

    .from("suggestion_categories")

    .select("id, name, code, description, status, display_order")

    .order("display_order");

  const { data: templateVersions } = await supabase

    .from("template_versions")

    .select("id, version_number, template_id, templates(display_name)")

    .eq("status", "published")

    .order("version_number", { ascending: false });

  return (
    <div
      className="flex flex-col gap-8"
      data-testid="suggestion-programmes-page"
    >
      <PageHeader
        title="Suggestions configuration"

        description="Manage improvement programmes and the categories used for suggestion submission."

        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/platform/suggestions">Back to suggestions</Link>
          </Button>
        }
      />

      <ProgrammeManagement
        programmes={programmes ?? []}

        versions={versions ?? []}

        categories={categories ?? []}

        templateVersions={
          (templateVersions ?? []) as Parameters<
            typeof ProgrammeManagement
          >[0]["templateVersions"]
        }
      />
    </div>
  );
}
