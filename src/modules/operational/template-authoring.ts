import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/platform/supabase/database.types";

export const TEMPLATE_AUTHORING_SECTION_COLUMNS =
  "id, title, position" as const;
export const TEMPLATE_AUTHORING_QUESTION_COLUMNS =
  "id, section_id, prompt, question_type, position" as const;

export type TemplateAuthoringSectionRow = {
  id: string;
  title: string;
  position: number;
};

export type TemplateAuthoringQuestionRow = {
  id: string;
  section_id: string;
  prompt: string;
  question_type: string;
  position: number;
};

export type TemplateAuthoringQuestion = {
  id: string;
  sectionId: string;
  prompt: string;
  questionType: string;
  position: number;
};

export type TemplateAuthoringSection = {
  id: string;
  title: string;
  position: number;
  questions: TemplateAuthoringQuestion[];
};

export type TemplateAuthoringChildren = {
  sections: TemplateAuthoringSection[];
  usableQuestionCount: number;
  nextSectionPosition: number;
};

type TemplateAuthoringClient = Pick<SupabaseClient<Database>, "from">;

function compareByPositionThenId(
  left: { id: string; position: number },
  right: { id: string; position: number },
): number {
  if (left.position !== right.position) {
    return left.position - right.position;
  }
  return left.id.localeCompare(right.id);
}

function isUsablePrompt(prompt: string): boolean {
  return prompt.trim().length > 0;
}

export function emptyTemplateAuthoringChildren(): TemplateAuthoringChildren {
  return {
    sections: [],
    usableQuestionCount: 0,
    nextSectionPosition: 1,
  };
}

export function assembleTemplateAuthoringChildren(
  sections: TemplateAuthoringSectionRow[],
  questions: TemplateAuthoringQuestionRow[],
): TemplateAuthoringChildren {
  const sortedSections = [...sections].sort(compareByPositionThenId);
  const sortedQuestions = [...questions].sort(compareByPositionThenId);

  const assembled = sortedSections.map((section) => ({
    id: section.id,
    title: section.title,
    position: section.position,
    questions: sortedQuestions
      .filter((question) => question.section_id === section.id)
      .map((question) => ({
        id: question.id,
        sectionId: question.section_id,
        prompt: question.prompt,
        questionType: question.question_type,
        position: question.position,
      })),
  }));

  const usableQuestionCount = assembled.reduce(
    (count, section) =>
      count +
      section.questions.filter((question) => isUsablePrompt(question.prompt))
        .length,
    0,
  );

  return {
    sections: assembled,
    usableQuestionCount,
    nextSectionPosition:
      sortedSections.reduce(
        (maxPosition, section) => Math.max(maxPosition, section.position),
        0,
      ) + 1,
  };
}

export function nextQuestionPosition(
  section: TemplateAuthoringSection | undefined,
): number {
  if (!section || section.questions.length === 0) {
    return 1;
  }

  return (
    section.questions.reduce(
      (maxPosition, question) => Math.max(maxPosition, question.position),
      0,
    ) + 1
  );
}

export function isTemplateAuthoringPublishReady(
  children: TemplateAuthoringChildren,
): boolean {
  return children.usableQuestionCount > 0;
}

export async function loadTemplateAuthoringChildren(
  supabase: TemplateAuthoringClient,
  templateVersionId: string | null | undefined,
): Promise<TemplateAuthoringChildren> {
  if (!templateVersionId) {
    return emptyTemplateAuthoringChildren();
  }

  const { data: sectionsRaw } = await supabase
    .from("template_sections")
    .select(TEMPLATE_AUTHORING_SECTION_COLUMNS)
    .eq("template_version_id", templateVersionId)
    .order("position");

  const { data: questionsRaw } = await supabase
    .from("template_questions")
    .select(TEMPLATE_AUTHORING_QUESTION_COLUMNS)
    .eq("template_version_id", templateVersionId)
    .order("position");

  return assembleTemplateAuthoringChildren(
    sectionsRaw ?? [],
    questionsRaw ?? [],
  );
}
