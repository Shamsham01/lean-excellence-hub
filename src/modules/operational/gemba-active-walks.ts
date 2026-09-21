import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/platform/supabase/database.types";

export type GembaActiveWalk = {
  id: string;
  definition_name_snapshot: string | null;
  unit_name_snapshot: string | null;
  started_at: string | null;
  status: string;
};

export const GEMBA_ACTIVE_WALK_SELECT =
  "id, definition_name_snapshot, unit_name_snapshot, started_at, status";

export function formatGembaWalkResumePrimaryLabel(
  walk: Pick<GembaActiveWalk, "definition_name_snapshot" | "id">,
) {
  const label = walk.definition_name_snapshot?.trim();
  return label && label.length > 0 ? label : "Gemba walk";
}

export function formatGembaWalkResumeSecondaryLabel(
  walk: Pick<GembaActiveWalk, "unit_name_snapshot">,
) {
  const label = walk.unit_name_snapshot?.trim();
  return label && label.length > 0 ? label : "Organisational unit not recorded";
}

export function formatGembaWalkStartedDate(startedAt: string | null) {
  if (!startedAt) {
    return null;
  }

  return new Date(startedAt).toLocaleDateString("en-GB");
}

export async function loadGembaDefinitionVersionIds(
  supabase: SupabaseClient<Database>,
  definitionId: string,
) {
  const { data, error } = await supabase
    .from("gemba_definition_versions")
    .select("id")
    .eq("definition_id", definitionId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((version) => version.id);
}

export async function findResumableGembaWalkId(
  supabase: SupabaseClient<Database>,
  definitionId: string,
  unitId: string,
) {
  const versionIds = await loadGembaDefinitionVersionIds(
    supabase,
    definitionId,
  );
  if (versionIds.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("gemba_walks")
    .select("id")
    .eq("status", "in_progress")
    .eq("unit_id", unitId)
    .in("definition_version_id", versionIds)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

export async function loadActiveGembaWalksForDefinitionVersions(
  supabase: SupabaseClient<Database>,
  versionIds: string[],
) {
  if (versionIds.length === 0) {
    return [] as GembaActiveWalk[];
  }

  const { data, error } = await supabase
    .from("gemba_walks")
    .select(GEMBA_ACTIVE_WALK_SELECT)
    .eq("status", "in_progress")
    .in("definition_version_id", versionIds)
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as GembaActiveWalk[];
}
