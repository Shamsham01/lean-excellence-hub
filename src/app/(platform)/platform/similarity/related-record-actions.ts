"use server";

import {
  parseAuthorisedSimilarityMatches,
  type AuthorisedSimilarityMatch,
  type AuthorisedSimilarityRecordType,
} from "@/modules/improvement/authorised-similarity";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const UNAVAILABLE: Record<AuthorisedSimilarityRecordType, string> = {
  improvement_suggestion: "Related suggestions could not be searched.",
  action: "Related actions could not be searched.",
};

export type AuthorisedSimilarityResult = {
  error?: string;
  matches: AuthorisedSimilarityMatch[];
};

export async function findAuthorisedSimilarRecords(input: {
  recordType: AuthorisedSimilarityRecordType;
  query: string;
}): Promise<AuthorisedSimilarityResult> {
  const query = input.query.trim().slice(0, 2000);

  try {
    const supabase = await createServerSupabaseClient();
    const rpcName =
      input.recordType === "improvement_suggestion"
        ? "search_authorised_improvement_suggestions"
        : "search_authorised_actions";

    const { data, error } = await supabase.rpc(rpcName, {
      target_query: query,
      target_limit: 8,
    });

    if (error) {
      return {
        error: UNAVAILABLE[input.recordType],
        matches: [],
      };
    }

    return {
      matches: parseAuthorisedSimilarityMatches(input.recordType, data),
    };
  } catch {
    return {
      error: UNAVAILABLE[input.recordType],
      matches: [],
    };
  }
}
