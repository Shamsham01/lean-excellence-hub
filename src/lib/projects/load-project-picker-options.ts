import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
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

const PICKER_PAGE_SIZE = 100;
const PICKER_MAX_PAGES = 2;

async function fetchPortfolioPage(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  args: Record<string, unknown>,
  page: number,
): Promise<ProjectPortfolioResponse> {
  const { data } = await callProjectRpc<ProjectPortfolioResponse>(
    supabase,
    "get_ci_projects_portfolio",
    {
      ...args,
      target_page: page,
      target_page_size: PICKER_PAGE_SIZE,
      target_linkable_only: true,
    },
  );
  return (
    data ?? {
      items: [],
      total_count: 0,
      page,
      page_size: PICKER_PAGE_SIZE,
    }
  );
}

export async function loadProjectPickerOptions(
  targetSearch?: string | null,
): Promise<ProjectPickerOptions> {
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

  const portfolioArgs: Record<string, unknown> = {};
  const trimmedSearch = targetSearch?.trim();
  if (trimmedSearch) {
    portfolioArgs.target_search = trimmedSearch;
  }

  if (
    selectorOptions.context.mode === "site" &&
    selectorOptions.context.activeSiteId
  ) {
    portfolioArgs.target_site_unit_id = selectorOptions.context.activeSiteId;
  }

  const projects: ProjectSelectorOption[] = [];
  let page = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while (projects.length < totalCount && page <= PICKER_MAX_PAGES) {
    const portfolio = await fetchPortfolioPage(supabase, portfolioArgs, page);
    totalCount = portfolio.total_count;
    projects.push(...portfolio.items);
    if (portfolio.items.length < PICKER_PAGE_SIZE) {
      break;
    }
    page += 1;
  }

  return {
    projects,
    requiresSiteSelection: false,
  };
}
