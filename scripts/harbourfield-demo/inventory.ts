import type { SupabaseClient } from "@supabase/supabase-js";

import { HARBOURFIELD_STORYLINE } from "./constants";

export type HarbourfieldDemoInventory = {
  maturityModelPublished: boolean;
  publishedOfficialMaturityResult: boolean;
  inProgressSelfAssessment: boolean;
  fiveSStandardPublished: boolean;
  completedFiveSAudit: boolean;
  inProgressFiveSAudit: boolean;
  gembaDefinitionPublished: boolean;
  completedGembaWalk: boolean;
  inProgressGembaWalk: boolean;
  storyCorrectiveAction: boolean;
  overdueOpenAction: boolean;
  problemSolvingCaseActive: boolean;
  openProblemSolvingSession: boolean;
  activeStoryProject: boolean;
  benefitAwaitingValidation: boolean;
  suggestionAwaitingReview: boolean;
  suggestionProgrammePublished: boolean;
};

export async function collectHarbourfieldDemoInventory(
  client: SupabaseClient,
): Promise<HarbourfieldDemoInventory> {
  const story = HARBOURFIELD_STORYLINE;
  const nowIso = new Date().toISOString();

  const { count: maturityModelCount } = await client
    .from("maturity_models")
    .select("id", { count: "exact", head: true })
    .eq("display_name", story.maturityModelName);

  const { count: publishedResultCount } = await client
    .from("maturity_official_results")
    .select("id", { count: "exact", head: true });

  const { count: selfAssessmentCount } = await client
    .from("maturity_assessments")
    .select("id", { count: "exact", head: true })
    .eq("assessment_type", "self")
    .in("status", ["draft", "in_progress", "submitted"]);

  const { count: fiveSStandardCount } = await client
    .from("five_s_standards")
    .select("id", { count: "exact", head: true })
    .eq("display_name", story.fiveSStandardName);

  const { count: completedFiveSCount } = await client
    .from("five_s_audits")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  const { count: inProgressFiveSCount } = await client
    .from("five_s_audits")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress");

  const { count: gembaDefinitionCount } = await client
    .from("gemba_definitions")
    .select("id", { count: "exact", head: true })
    .eq("display_name", story.gembaDefinitionName);

  const { count: completedGembaCount } = await client
    .from("gemba_walks")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");

  const { count: inProgressGembaCount } = await client
    .from("gemba_walks")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress");

  const { count: correctiveActionCount } = await client
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("title", story.correctiveActionTitle);

  const { count: overdueActionCount } = await client
    .from("actions")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "in_progress"])
    .lt("due_at", nowIso)
    .eq("title", story.overdueActionTitle);

  const { data: psCase } = await client
    .from("problem_solving_cases")
    .select("id, status")
    .eq("title", story.problemSolvingCaseTitle)
    .maybeSingle();

  let openSession = false;
  if (psCase?.id) {
    const { count: sessionCount } = await client
      .from("problem_solving_sessions")
      .select("id", { count: "exact", head: true })
      .eq("case_id", psCase.id)
      .eq("status", "in_progress");
    openSession = (sessionCount ?? 0) > 0;
  }

  const { data: project } = await client
    .from("ci_projects")
    .select("id, status")
    .eq("title", story.projectTitle)
    .maybeSingle();

  const { count: benefitCount } = await client
    .from("improvement_benefits")
    .select("id", { count: "exact", head: true })
    .eq("title", story.benefitTitle)
    .in("status", ["submitted", "approved"]);

  const { count: storySuggestionCount } = await client
    .from("improvement_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("title", story.suggestionTitle)
    .eq("status", "submitted");

  const { count: programmeCount } = await client
    .from("suggestion_programmes")
    .select("id", { count: "exact", head: true })
    .eq("code", story.suggestionProgrammeCode);

  const { count: programmeVersionCount } = await client
    .from("suggestion_programme_versions")
    .select("id", { count: "exact", head: true })
    .eq("lifecycle", "published");

  const { count: suggestionCategoryCount } = await client
    .from("suggestion_categories")
    .select("id", { count: "exact", head: true })
    .eq("code", "quality");

  return {
    maturityModelPublished: (maturityModelCount ?? 0) > 0,
    publishedOfficialMaturityResult: (publishedResultCount ?? 0) > 0,
    inProgressSelfAssessment: (selfAssessmentCount ?? 0) > 0,
    fiveSStandardPublished: (fiveSStandardCount ?? 0) > 0,
    completedFiveSAudit: (completedFiveSCount ?? 0) > 0,
    inProgressFiveSAudit: (inProgressFiveSCount ?? 0) > 0,
    gembaDefinitionPublished: (gembaDefinitionCount ?? 0) > 0,
    completedGembaWalk: (completedGembaCount ?? 0) > 0,
    inProgressGembaWalk: (inProgressGembaCount ?? 0) > 0,
    storyCorrectiveAction: (correctiveActionCount ?? 0) > 0,
    overdueOpenAction: (overdueActionCount ?? 0) > 0,
    problemSolvingCaseActive:
      psCase != null && psCase.status !== "closed" && psCase.status !== "draft",
    openProblemSolvingSession: openSession,
    activeStoryProject:
      project != null && !["completed", "cancelled"].includes(project.status),
    benefitAwaitingValidation: (benefitCount ?? 0) > 0,
    suggestionAwaitingReview: (storySuggestionCount ?? 0) > 0,
    suggestionProgrammePublished:
      (programmeCount ?? 0) > 0 ||
      (programmeVersionCount ?? 0) > 0 ||
      (suggestionCategoryCount ?? 0) > 0 ||
      (storySuggestionCount ?? 0) > 0,
  };
}
