import { describe, expect, it, vi } from "vitest";

import {
  assembleTemplateAuthoringChildren,
  isTemplateAuthoringPublishReady,
  loadTemplateAuthoringChildren,
  nextQuestionPosition,
  TEMPLATE_AUTHORING_QUESTION_COLUMNS,
  TEMPLATE_AUTHORING_SECTION_COLUMNS,
} from "@/modules/operational/template-authoring";

describe("template authoring read model", () => {
  it("orders sections and questions deterministically by position then id", () => {
    const children = assembleTemplateAuthoringChildren(
      [
        { id: "section-b", title: "Set in order", position: 2 },
        { id: "section-a", title: "Sort", position: 1 },
      ],
      [
        {
          id: "question-2",
          section_id: "section-a",
          prompt: "Second question",
          question_type: "yes_no",
          position: 2,
        },
        {
          id: "question-1",
          section_id: "section-a",
          prompt: "First question",
          question_type: "yes_no",
          position: 1,
        },
        {
          id: "question-gemba",
          section_id: "section-b",
          prompt: "Walk prompt",
          question_type: "short_text",
          position: 1,
        },
      ],
    );

    expect(children.sections.map((section) => section.title)).toEqual([
      "Sort",
      "Set in order",
    ]);
    expect(
      children.sections[0]?.questions.map((question) => question.prompt),
    ).toEqual(["First question", "Second question"]);
    expect(children.nextSectionPosition).toBe(3);
    expect(nextQuestionPosition(children.sections[0])).toBe(3);
    expect(nextQuestionPosition(children.sections[1])).toBe(2);
  });

  it("treats empty and whitespace-only prompts as incomplete", () => {
    const children = assembleTemplateAuthoringChildren(
      [{ id: "section-a", title: "Sort", position: 1 }],
      [
        {
          id: "question-empty",
          section_id: "section-a",
          prompt: "   ",
          question_type: "short_text",
          position: 1,
        },
      ],
    );

    expect(children.usableQuestionCount).toBe(0);
    expect(isTemplateAuthoringPublishReady(children)).toBe(false);
  });

  it("does not allow publish until at least one usable question exists", () => {
    const empty = assembleTemplateAuthoringChildren([], []);
    const sectionOnly = assembleTemplateAuthoringChildren(
      [{ id: "section-a", title: "Sort", position: 1 }],
      [],
    );
    const ready = assembleTemplateAuthoringChildren(
      [{ id: "section-a", title: "Sort", position: 1 }],
      [
        {
          id: "question-1",
          section_id: "section-a",
          prompt: "Is the area clear?",
          question_type: "yes_no",
          position: 1,
        },
      ],
    );

    expect(isTemplateAuthoringPublishReady(empty)).toBe(false);
    expect(isTemplateAuthoringPublishReady(sectionOnly)).toBe(false);
    expect(isTemplateAuthoringPublishReady(ready)).toBe(true);
    expect(ready.usableQuestionCount).toBe(1);
  });

  it("assigns the next section position from max position, not list length", () => {
    const children = assembleTemplateAuthoringChildren(
      [
        { id: "section-a", title: "Sort", position: 1 },
        { id: "section-c", title: "Shine", position: 4 },
      ],
      [],
    );

    expect(children.nextSectionPosition).toBe(5);
  });

  it("loads children through the authoring section and question queries", async () => {
    const sectionSelect = vi.fn();
    const questionSelect = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "template_sections") {
          return {
            select: (columns: string) => {
              sectionSelect(columns);
              return {
                eq: (column: string, value: string) => {
                  expect(column).toBe("template_version_id");
                  expect(value).toBe("template-version-1");
                  return {
                    order: async (orderColumn: string) => {
                      expect(orderColumn).toBe("position");
                      return {
                        data: [{ id: "section-a", title: "Sort", position: 1 }],
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        }

        expect(table).toBe("template_questions");
        return {
          select: (columns: string) => {
            questionSelect(columns);
            return {
              eq: (column: string, value: string) => {
                expect(column).toBe("template_version_id");
                expect(value).toBe("template-version-1");
                return {
                  order: async (orderColumn: string) => {
                    expect(orderColumn).toBe("position");
                    return {
                      data: [
                        {
                          id: "question-1",
                          section_id: "section-a",
                          prompt: "Persisted question",
                          question_type: "yes_no",
                          position: 1,
                        },
                      ],
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }),
    };

    const children = await loadTemplateAuthoringChildren(
      supabase as never,
      "template-version-1",
    );

    expect(sectionSelect).toHaveBeenCalledWith(
      TEMPLATE_AUTHORING_SECTION_COLUMNS,
    );
    expect(questionSelect).toHaveBeenCalledWith(
      TEMPLATE_AUTHORING_QUESTION_COLUMNS,
    );
    expect(children.sections).toHaveLength(1);
    expect(children.sections[0]?.questions[0]?.prompt).toBe(
      "Persisted question",
    );
    expect(isTemplateAuthoringPublishReady(children)).toBe(true);
  });

  it("fails closed when template_sections cannot be loaded", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        expect(table).toBe("template_sections");
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [{ id: "section-a", title: "Sort", position: 1 }],
                error: { message: "permission denied for template_sections" },
              }),
            }),
          }),
        };
      }),
    };

    await expect(
      loadTemplateAuthoringChildren(supabase as never, "template-version-1"),
    ).rejects.toThrow(
      "Failed to load template_sections: permission denied for template_sections",
    );
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith("template_sections");
  });

  it("fails closed when template_questions cannot be loaded", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "template_sections") {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [{ id: "section-a", title: "Sort", position: 1 }],
                  error: null,
                }),
              }),
            }),
          };
        }

        expect(table).toBe("template_questions");
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    id: "question-1",
                    section_id: "section-a",
                    prompt: "Should not be used",
                    question_type: "yes_no",
                    position: 1,
                  },
                ],
                error: { message: "permission denied for template_questions" },
              }),
            }),
          }),
        };
      }),
    };

    await expect(
      loadTemplateAuthoringChildren(supabase as never, "template-version-1"),
    ).rejects.toThrow(
      "Failed to load template_questions: permission denied for template_questions",
    );
    expect(supabase.from).toHaveBeenCalledTimes(2);
    expect(supabase.from).toHaveBeenCalledWith("template_sections");
    expect(supabase.from).toHaveBeenCalledWith("template_questions");
  });
});
