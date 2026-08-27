import { PageHeader } from "@/components/platform/page-header";

import { NewSuggestionForm } from "@/components/suggestions/new-suggestion-form";

import { Card, CardContent } from "@/components/ui/card";

import { createServerSupabaseClient } from "@/platform/supabase/server";

type ProgrammeVersionRow = {
  id: string;

  programme_id: string;

  suggestion_programmes: { name: string } | { name: string }[] | null;
};

export default async function NewSuggestionPage() {
  const supabase = await createServerSupabaseClient();

  const { data: joinedVersions, error: joinedError } = await supabase

    .from("suggestion_programme_versions")

    .select("id, programme_id, suggestion_programmes(name)")

    .eq("lifecycle", "published");

  let programmesForForm =
    (joinedVersions as ProgrammeVersionRow[] | null)?.map((row) => {
      const programme = Array.isArray(row.suggestion_programmes)
        ? row.suggestion_programmes[0]
        : row.suggestion_programmes;

      return {
        id: row.id,

        programme_name: programme?.name ?? "Programme",
      };
    }) ?? [];

  let loadError = joinedError?.message ?? null;

  if (programmesForForm.length === 0) {
    const { data: programmeVersions, error: versionsError } = await supabase

      .from("suggestion_programme_versions")

      .select("id, programme_id")

      .eq("lifecycle", "published");

    if (versionsError) {
      loadError = versionsError.message;
    } else if (programmeVersions && programmeVersions.length > 0) {
      const { data: programmes, error: programmesError } = await supabase

        .from("suggestion_programmes")

        .select("id, name");

      if (programmesError) {
        loadError = programmesError.message;
      } else {
        const programmeNameById = new Map(
          programmes?.map((p) => [p.id, p.name]) ?? [],
        );

        programmesForForm = programmeVersions.map((row) => ({
          id: row.id,

          programme_name:
            programmeNameById.get(row.programme_id) ?? "Programme",
        }));
      }
    }
  }

  const { data: categories, error: categoriesError } = await supabase

    .from("suggestion_categories")

    .select("id, name")

    .eq("status", "active")

    .order("display_order");

  if (categoriesError) {
    loadError = loadError ?? categoriesError.message;
  }

  return (
    <div
      className="mx-auto flex max-w-xl flex-col gap-6"
      data-testid="new-suggestion-page"
    >
      <PageHeader
        title="New suggestion"

        description="Share what you've noticed and what you'd change — takes about a minute."
      />

      {loadError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Could not load submission options: {loadError}
          </CardContent>
        </Card>
      ) : null}

      <NewSuggestionForm
        programmeVersions={programmesForForm}
        categories={categories ?? []}
      />
    </div>
  );
}
