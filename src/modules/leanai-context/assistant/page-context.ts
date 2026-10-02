import type { LeanAiAssistantView } from "@/modules/leanai-context/assistant/types";
import type { CoachPageContext } from "@/modules/leanai-context/coach/context-assembly";

export function coachPageContextFromView(
  view: LeanAiAssistantView,
): CoachPageContext {
  return {
    module: view.page.module,
    workflow: view.page.workflow,
    route: view.page.route,
    pageTitle: view.page.pageTitle,
    contextLabel: view.contextLabel,
    authoringStep: view.page.authoringStep,
    entityValidated: view.page.entityValidated,
    siteMode: view.site.mode,
    activeSiteName: view.site.activeSiteName,
    summary: view.summary,
    terminology: view.terminology,
    remainingSetup: view.remainingSetup,
    relevantState: view.relevantState,
    allowedActions: view.allowedActions,
    starterPrompts: view.starterPrompts,
  };
}
