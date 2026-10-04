import type { SupabaseClient } from "@supabase/supabase-js";

import { sortMaturityQuestions } from "@/modules/maturity/framework-authoring";
import { throwPlatformBoundaryError } from "@/platform/observability/platform-boundary";
import type { Database } from "@/platform/supabase/database.types";
import { readSupabaseErrorFields } from "@/platform/supabase/error-classification";

/** Bounded query count for one version structure load, independent of framework size. */
export const FRAMEWORK_STRUCTURE_QUERY_BUDGET = 5;

export const FRAMEWORK_STRUCTURE_LOAD_OPERATIONS = {
  levels: "maturity framework levels load failed",
  pillars: "maturity framework pillars load failed",
  criteria: "maturity framework criteria load failed",
  links: "maturity criterion links load failed",
  questions: "maturity questions load failed",
} as const;

export type FrameworkStructureClient = Pick<SupabaseClient<Database>, "from">;

export type FrameworkStructureLevel = {
  id: string;
  level_number: number;
  name: string;
  color_token: string;
  description: string | null;
  guidance: string | null;
};

export type FrameworkStructurePillar = {
  id: string;
  name: string;
  position: number;
  section_id: string;
  description: string | null;
  guidance: string | null;
};

export type FrameworkStructureCriterion = {
  id: string;
  name: string;
  pillar_id: string;
  position: number;
  description: string | null;
  guidance: string | null;
};

export type FrameworkStructureQuestion = {
  id: string;
  prompt: string;
  criterion_id: string;
  position: number;
};

export type FrameworkStructureSnapshot = {
  levels: FrameworkStructureLevel[];
  pillars: FrameworkStructurePillar[];
  criteria: FrameworkStructureCriterion[];
  questions: FrameworkStructureQuestion[];
};

type QueryResult<T> = {
  data: T[] | null;
  error: unknown;
};

type ScoredCriterionQuestionLink = {
  criterion_id: string;
  question_id: string;
};

type TemplateQuestionRow = {
  id: string;
  prompt: string;
  position: number;
};

function requireQueryRows<T>(result: QueryResult<T>, operation: string): T[] {
  if (result.error) {
    const { code, message } = readSupabaseErrorFields(result.error);
    throwPlatformBoundaryError({
      category: "organisation_access",
      operation,
      supabaseError: { code, message },
      cause: result.error,
    });
  }

  return result.data ?? [];
}

export function assembleFrameworkStructureQuestions(
  links: readonly ScoredCriterionQuestionLink[],
  questionRows: readonly TemplateQuestionRow[],
): FrameworkStructureQuestion[] {
  const questionById = new Map(
    questionRows.map((question) => [question.id, question]),
  );

  const assembled: FrameworkStructureQuestion[] = [];
  for (const link of links) {
    const question = questionById.get(link.question_id);
    if (!question) {
      continue;
    }
    assembled.push({
      id: question.id,
      prompt: question.prompt,
      criterion_id: link.criterion_id,
      position: question.position,
    });
  }

  return sortMaturityQuestions(assembled);
}

/**
 * Loads one maturity model version's authoring structure with a bounded
 * number of Supabase queries (O(1) in pillar/criterion/question count).
 */
export async function loadFrameworkStructure(
  supabase: FrameworkStructureClient,
  versionId: string,
): Promise<FrameworkStructureSnapshot> {
  const [levelsResult, pillarsResult] = await Promise.all([
    supabase
      .from("maturity_levels")
      .select("id, level_number, name, color_token, description, guidance")
      .eq("model_version_id", versionId)
      .order("level_number"),
    supabase
      .from("maturity_pillars")
      .select("id, name, position, section_id, description, guidance")
      .eq("model_version_id", versionId)
      .order("position"),
  ]);

  const levels = requireQueryRows(
    levelsResult,
    FRAMEWORK_STRUCTURE_LOAD_OPERATIONS.levels,
  );
  const pillars = requireQueryRows(
    pillarsResult,
    FRAMEWORK_STRUCTURE_LOAD_OPERATIONS.pillars,
  );

  const pillarIds = pillars.map((pillar) => pillar.id);
  if (pillarIds.length === 0) {
    return { levels, pillars, criteria: [], questions: [] };
  }

  const criteria = requireQueryRows(
    await supabase
      .from("maturity_criteria")
      .select("id, name, pillar_id, position, description, guidance")
      .in("pillar_id", pillarIds)
      .order("position"),
    FRAMEWORK_STRUCTURE_LOAD_OPERATIONS.criteria,
  );

  const criterionIds = criteria.map((criterion) => criterion.id);
  if (criterionIds.length === 0) {
    return { levels, pillars, criteria, questions: [] };
  }

  const links = requireQueryRows(
    await supabase
      .from("maturity_criterion_questions")
      .select("criterion_id, question_id")
      .in("criterion_id", criterionIds)
      .eq("contributes_to_score", true),
    FRAMEWORK_STRUCTURE_LOAD_OPERATIONS.links,
  );

  const questionIds = [...new Set(links.map((link) => link.question_id))];
  if (questionIds.length === 0) {
    return { levels, pillars, criteria, questions: [] };
  }

  const questionRows = requireQueryRows(
    await supabase
      .from("template_questions")
      .select("id, prompt, position")
      .in("id", questionIds),
    FRAMEWORK_STRUCTURE_LOAD_OPERATIONS.questions,
  );

  return {
    levels,
    pillars,
    criteria,
    questions: assembleFrameworkStructureQuestions(links, questionRows),
  };
}
