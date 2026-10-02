import type { AssistantRelevantState } from "./types";

export type SuggestionProgrammeRow = {
  id: string;
  name: string;
  status: string | null;
};

export type SuggestionProgrammeVersionRow = {
  programme_id: string;
  lifecycle: string | null;
};

export type SuggestionCategoryRow = {
  id: string;
  name: string;
  status: string | null;
};

export type SuggestionsSetupState = {
  relevantState: AssistantRelevantState;
  remaining: string[];
  allowedActions: string[];
};

export function buildSuggestionsSetupState(input: {
  programmes: readonly SuggestionProgrammeRow[];
  versions: readonly SuggestionProgrammeVersionRow[];
  categories: readonly SuggestionCategoryRow[];
  canManageProgrammes: boolean;
}): SuggestionsSetupState {
  const activeProgrammes = input.programmes.filter(
    (programme) => programme.status === "active",
  );
  const publishedVersions = input.versions.filter(
    (version) => version.lifecycle === "published",
  );
  const draftVersions = input.versions.filter(
    (version) => version.lifecycle === "draft",
  );
  const activeCategories = input.categories.filter(
    (category) => category.status === "active",
  );
  const publishedProgrammeIds = new Set(
    publishedVersions.map((version) => version.programme_id),
  );
  const activePublishedCount = activeProgrammes.filter((programme) =>
    publishedProgrammeIds.has(programme.id),
  ).length;
  const submissionsPossible = activePublishedCount >= 1;

  const remaining: string[] = [];
  if (input.programmes.length === 0) {
    remaining.push("Create a Suggestion Programme.");
  } else if (activePublishedCount === 0) {
    remaining.push(
      "Publish an active Suggestion Programme version so people can submit ideas.",
    );
  }
  if (input.categories.length === 0) {
    remaining.push(
      "Add organisation-level suggestion categories such as Safety or Quality.",
    );
  }

  return {
    relevantState: {
      programmeCount: input.programmes.length,
      activeProgrammeCount: activeProgrammes.length,
      publishedVersionCount: publishedVersions.length,
      draftVersionCount: draftVersions.length,
      categoryCount: input.categories.length,
      activeCategoryCount: activeCategories.length,
      submissionsPossible,
      programmeNames: activeProgrammes
        .map((programme) => programme.name)
        .slice(0, 8)
        .join(", "),
      categoryNames: activeCategories
        .map((category) => category.name)
        .slice(0, 12)
        .join(", "),
    },
    remaining,
    allowedActions: input.canManageProgrammes
      ? [
          "Create or edit programmes",
          "Publish a programme version",
          "Maintain the category catalogue",
        ]
      : ["View this page if it is already visible"],
  };
}

export function suggestionsSetupGuidance(state: SuggestionsSetupState): string {
  if (state.relevantState.submissionsPossible === true) {
    if (Number(state.relevantState.categoryCount) === 0) {
      return "A published Suggestion Programme exists, but the organisation-level category catalogue is empty. Categories classify ideas; they are not programmes.";
    }
    return "Suggestions can currently be submitted against an active published programme. Categories remain a separate organisation-level catalogue.";
  }
  if (Number(state.relevantState.programmeCount) === 0) {
    return "No Suggestion Programme exists yet. Create a programme (the campaign people submit under) and publish a version. Add categories separately as organisation-level classifications.";
  }
  return "A Suggestion Programme exists but is not active and published, so people cannot submit ideas yet. Categories, if any, are a separate catalogue and do not publish the programme.";
}
