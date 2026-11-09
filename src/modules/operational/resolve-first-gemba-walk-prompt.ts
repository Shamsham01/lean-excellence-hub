import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/platform/supabase/database.types";

export async function resolveFirstGembaWalkPromptId(
  supabase: SupabaseClient<Database>,
  walkId: string,
): Promise<string | null> {
  const { data: walk } = await supabase
    .from("gemba_walks")
    .select("definition_version_id")
    .eq("id", walkId)
    .maybeSingle();

  if (!walk?.definition_version_id) {
    return null;
  }

  const { data: version } = await supabase
    .from("gemba_definition_versions")
    .select("template_version_id")
    .eq("id", walk.definition_version_id)
    .maybeSingle();

  const templateVersionId = version?.template_version_id;
  if (!templateVersionId) {
    return null;
  }

  const { data: sections } = await supabase
    .from("template_sections")
    .select("id")
    .eq("template_version_id", templateVersionId)
    .order("position", { ascending: true })
    .limit(1);

  const sectionId = sections?.[0]?.id;
  if (!sectionId) {
    return null;
  }

  const { data: questions } = await supabase
    .from("template_questions")
    .select("id")
    .eq("section_id", sectionId)
    .order("position", { ascending: true })
    .limit(1);

  return questions?.[0]?.id ?? null;
}
