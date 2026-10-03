import { parseAuthoringStep } from "@/lib/authoring/authoring-query";
import type { LeanAiCoachSurface } from "@/modules/leanai-context/interventions/types";
import type { LeanAiModuleKey } from "@/modules/leanai-context/types";

import { MATURITY_AUTHORING_STEPS, isAssistantUuid } from "./constants";
import type { AssistantRouteIdentity, AssistantWorkflow } from "./types";

type RouteMatch = {
  module: LeanAiModuleKey;
  workflow: AssistantWorkflow;
  pageTitle: string;
  surface: LeanAiCoachSurface;
  entityId?: string | null;
  authoringStep?: AssistantRouteIdentity["authoringStep"];
};

function normalisePathname(pathname: string): string {
  const trimmed = pathname.trim().split("?")[0] ?? "";
  if (!trimmed.startsWith("/")) {
    return "/platform";
  }
  const withoutTrailing =
    trimmed.length > 1 && trimmed.endsWith("/")
      ? trimmed.slice(0, -1)
      : trimmed;
  return withoutTrailing || "/platform";
}

function matchPlatformRoute(pathname: string): RouteMatch {
  if (pathname === "/platform") {
    return {
      module: "platform",
      workflow: "platform_home",
      pageTitle: "Workspace home",
      surface: "platform_home",
    };
  }
  if (pathname === "/platform/setup") {
    return {
      module: "setup",
      workflow: "organisation_setup",
      pageTitle: "Organisation setup",
      surface: "setup",
    };
  }
  if (pathname === "/platform/settings") {
    return {
      module: "setup",
      workflow: "organisation_setup",
      pageTitle: "Settings",
      surface: "setup",
    };
  }
  if (pathname === "/platform/settings/organisation") {
    return {
      module: "organisation",
      workflow: "organisation_profile",
      pageTitle: "Organisation profile",
      surface: "setup",
    };
  }
  if (pathname === "/platform/settings/structure") {
    return {
      module: "sites",
      workflow: "structure",
      pageTitle: "Organisation structure",
      surface: "workspace",
    };
  }
  if (pathname === "/platform/settings/job-functions") {
    return {
      module: "people",
      workflow: "job_functions",
      pageTitle: "Job functions",
      surface: "workspace",
    };
  }
  if (
    pathname === "/platform/settings/people" ||
    pathname.startsWith("/platform/settings/people/")
  ) {
    return {
      module: "people",
      workflow: "people",
      pageTitle: "People setup",
      surface: "workspace",
    };
  }
  if (pathname === "/platform/settings/ai") {
    return {
      module: "lean_ai",
      workflow: "lean_ai_settings",
      pageTitle: "LeanAI settings",
      surface: "workspace",
    };
  }
  if (
    pathname === "/platform/people" ||
    pathname.startsWith("/platform/people/")
  ) {
    return {
      module: "people",
      workflow: "people",
      pageTitle: "People",
      surface: "workspace",
    };
  }
  if (pathname === "/platform/maturity") {
    return {
      module: "maturity",
      workflow: "maturity_overview",
      pageTitle: "Lean maturity",
      surface: "maturity",
    };
  }
  if (pathname === "/platform/maturity/models") {
    return {
      module: "maturity",
      workflow: "maturity_models",
      pageTitle: "Maturity frameworks",
      surface: "maturity",
    };
  }
  const maturityModel = pathname.match(
    /^\/platform\/maturity\/models\/([^/]+)$/,
  );
  if (maturityModel) {
    const entityId = maturityModel[1] ?? null;
    return {
      module: "maturity",
      workflow: "maturity_authoring",
      pageTitle: "Maturity framework authoring",
      surface: "maturity",
      entityId: isAssistantUuid(entityId) ? entityId : null,
    };
  }
  const maturityAssessment = pathname.match(
    /^\/platform\/maturity\/assessments\/([^/]+)$/,
  );
  if (maturityAssessment) {
    const entityId = maturityAssessment[1] ?? null;
    return {
      module: "maturity",
      workflow: "maturity_assessment",
      pageTitle: "Maturity assessment",
      surface: "maturity",
      entityId: isAssistantUuid(entityId) ? entityId : null,
    };
  }
  if (pathname.startsWith("/platform/maturity/")) {
    return {
      module: "maturity",
      workflow: "maturity_overview",
      pageTitle: "Lean maturity",
      surface: "maturity",
    };
  }
  if (pathname === "/platform/suggestions/programmes") {
    return {
      module: "suggestions",
      workflow: "programme_configuration",
      pageTitle: "Suggestions configuration",
      surface: "suggestions",
    };
  }
  if (
    pathname === "/platform/suggestions" ||
    pathname.startsWith("/platform/suggestions/")
  ) {
    return {
      module: "suggestions",
      workflow: "suggestions_overview",
      pageTitle: "Suggestions",
      surface: "suggestions",
    };
  }
  if (pathname === "/platform/5s" || pathname.startsWith("/platform/5s/")) {
    return {
      module: "five_s",
      workflow: "five_s",
      pageTitle: "5S",
      surface: "workspace",
    };
  }
  if (
    pathname === "/platform/gemba" ||
    pathname.startsWith("/platform/gemba/")
  ) {
    return {
      module: "gemba",
      workflow: "gemba",
      pageTitle: "Gemba",
      surface: "workspace",
    };
  }
  if (
    pathname === "/platform/training" ||
    pathname.startsWith("/platform/training/")
  ) {
    return {
      module: "training",
      workflow: "training",
      pageTitle: "Training",
      surface: "workspace",
    };
  }
  if (
    pathname === "/platform/skills" ||
    pathname.startsWith("/platform/skills/")
  ) {
    return {
      module: "skills",
      workflow: "skills",
      pageTitle: "Skills",
      surface: "workspace",
    };
  }
  if (
    pathname === "/platform/recognition" ||
    pathname.startsWith("/platform/recognition/")
  ) {
    return {
      module: "recognition",
      workflow: "recognition",
      pageTitle: "Recognition",
      surface: "workspace",
    };
  }
  return {
    module: "platform",
    workflow: "generic_platform",
    pageTitle: "Workspace",
    surface: "workspace",
  };
}

export function parseAssistantRoute(
  pathname: string,
  search = "",
): AssistantRouteIdentity {
  const normalised = normalisePathname(pathname);
  const match = matchPlatformRoute(normalised);
  const authoringStep =
    match.workflow === "maturity_authoring"
      ? parseAuthoringStep(
          new URLSearchParams(
            search.startsWith("?") ? search.slice(1) : search,
          ).get("step"),
          MATURITY_AUTHORING_STEPS,
          "details",
        )
      : null;

  return {
    pathname: normalised,
    search: search.startsWith("?") ? search : search ? `?${search}` : "",
    module: match.module,
    workflow: match.workflow,
    pageTitle: match.pageTitle,
    surface: match.surface,
    entityId: match.entityId ?? null,
    authoringStep,
  };
}

export function assistantRouteKey(identity: AssistantRouteIdentity): string {
  return [
    identity.pathname,
    identity.search,
    identity.workflow,
    identity.authoringStep ?? "",
    identity.entityId ?? "",
  ].join("|");
}
