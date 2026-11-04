"use server";

import { addProblemSolvingSourceLink } from "@/app/(platform)/platform/problem-solving/actions";
import { buildProblemSolvingConsultation } from "@/modules/problem-solving/consultation";
import {
  parseAuthorisedProblemSolvingHistory,
  type AuthorisedProblemSolvingCase,
} from "@/modules/problem-solving/authorised-history";
import type { ProblemSolvingConsultation } from "@/modules/problem-solving/consultation";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UNAVAILABLE = "Problem-solving history could not be searched.";

export type AuthorisedHistoryResult = {
  error?: string;
  matches: AuthorisedProblemSolvingCase[];
  consultation: ProblemSolvingConsultation;
};

function emptyConsultation(statement: string): ProblemSolvingConsultation {
  return buildProblemSolvingConsultation({
    userStatement: statement,
    matches: [],
  });
}

export async function findAuthorisedProblemSolvingHistory(input: {
  mode: "draft" | "case";
  query: string;
  caseId?: string;
}): Promise<AuthorisedHistoryResult> {
  const query = input.query.trim().slice(0, 500);
  const consultationInput = query.slice(0, 2000);

  try {
    const supabase = await createServerSupabaseClient();
    if (input.mode === "case") {
      if (!input.caseId || !UUID.test(input.caseId)) {
        return {
          error: UNAVAILABLE,
          matches: [],
          consultation: emptyConsultation(consultationInput),
        };
      }
      const { data, error } = await supabase.rpc(
        "search_similar_problem_solving_cases",
        {
          target_case_id: input.caseId,
          target_limit: 8,
        },
      );
      if (error) {
        return {
          error: UNAVAILABLE,
          matches: [],
          consultation: emptyConsultation(consultationInput),
        };
      }
      const matches = parseAuthorisedProblemSolvingHistory(data);
      return {
        matches,
        consultation: buildProblemSolvingConsultation({
          userStatement: consultationInput,
          matches,
        }),
      };
    }

    const { data, error } = await supabase.rpc(
      "search_authorised_problem_solving_history",
      {
        target_query: query,
        target_limit: 8,
      },
    );
    if (error) {
      return {
        error: UNAVAILABLE,
        matches: [],
        consultation: emptyConsultation(consultationInput),
      };
    }
    const matches = parseAuthorisedProblemSolvingHistory(data);
    return {
      matches,
      consultation: buildProblemSolvingConsultation({
        userStatement: consultationInput,
        matches,
      }),
    };
  } catch {
    return {
      error: UNAVAILABLE,
      matches: [],
      consultation: emptyConsultation(consultationInput),
    };
  }
}

export async function linkAuthorisedProblemSolvingCase(input: {
  caseId: string;
  relatedCaseId: string;
}): Promise<{ error?: string; ok?: true }> {
  if (!UUID.test(input.caseId) || !UUID.test(input.relatedCaseId)) {
    return { error: "That related case could not be linked." };
  }
  if (input.caseId === input.relatedCaseId) {
    return { error: "That related case could not be linked." };
  }
  const result = await addProblemSolvingSourceLink(
    input.caseId,
    input.relatedCaseId,
    "related",
  );
  if (result.error) {
    return { error: "That related case could not be linked." };
  }
  return { ok: true };
}
