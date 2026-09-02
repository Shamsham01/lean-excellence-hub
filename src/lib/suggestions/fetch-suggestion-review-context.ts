import "server-only";

import type { SuggestionReviewContext } from "@/lib/suggestions/types";
import type { createServerSupabaseClient } from "@/platform/supabase/server";

type ServerSupabaseClient = Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;

export async function fetchSuggestionReviewContext(
  supabase: ServerSupabaseClient,
  suggestionId: string,
): Promise<SuggestionReviewContext | null> {
  const { data, error } = await supabase.rpc("get_suggestion_review_context", {
    target_suggestion_id: suggestionId,
  });

  if (error) {
    return null;
  }

  return data as SuggestionReviewContext;
}
