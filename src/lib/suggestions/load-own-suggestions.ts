import "server-only";

import { listEligibleOrganisations } from "@/modules/organisations/context";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type OwnSuggestion = {
  id: string;
  title: string;
  status: string;
  suggestionNumber: string | null;
};

export async function loadOwnSuggestions(): Promise<
  | { status: "ready"; suggestions: OwnSuggestion[]; hasMore: boolean }
  | { status: "error"; message: string }
  | { status: "unavailable" }
> {
  const organisations = await listEligibleOrganisations();
  const membershipId = organisations.find(
    (organisation) => organisation.selected,
  )?.membership_id;
  if (!membershipId) return { status: "unavailable" };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("improvement_suggestions")
    .select("id, title, status, suggestion_number, created_at")
    .eq("author_membership_id", membershipId)
    .order("created_at", { ascending: false })
    .limit(26);

  if (error) {
    return {
      status: "error",
      message: "Your suggestions could not be loaded.",
    };
  }

  const rows = data ?? [];
  return {
    status: "ready",
    hasMore: rows.length > 25,
    suggestions: rows.slice(0, 25).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      suggestionNumber: row.suggestion_number,
    })),
  };
}
