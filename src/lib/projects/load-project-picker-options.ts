import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import { isCiProjectLinkableStatus } from "@/lib/projects/status";
import { callProjectRpc } from "@/lib/projects/supabase-untyped";
import type {
  ProjectPortfolioResponse,
  ProjectSelectorOption,
} from "@/lib/projects/types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export type ProjectPickerOptions = {
  projects: ProjectSelectorOption[];
  requiresSiteSelection: boolean;
};

export async function loadProjectPickerOptions(): Promise<ProjectPickerOptions> {
  const supabase = await createServerSupabaseClient();
  const selectorOptions = await loadSiteScopedSelectorOptions({
    requireConcreteSite: true,
  });

  if (selectorOptions.requiresSiteSelection) {
    return {
      projects: [],
      requiresSiteSelection: true,
    };
  }

  const portfolioArgs: Record<string, unknown> = {
    target_page: 1,
    target_page_size: 500,
  };

  if (
    selectorOptions.context.mode === "site" &&
    selectorOptions.context.activeSiteId
  ) {
    portfolioArgs.target_site_unit_id = selectorOptions.context.activeSiteId;
  }

  const { data: portfolio } = await callProjectRpc<ProjectPortfolioResponse>(
    supabase,
    "get_ci_projects_portfolio",
    portfolioArgs,
  );

  const projects = (portfolio?.items ?? []).filter((item) =>
    isCiProjectLinkableStatus(item.status),
  );

  return {
    projects,
    requiresSiteSelection: false,
  };
}
