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

export type ProjectPickerScope = {
  /** Record site — used when session site is unset or wrong for this link target. */
  siteUnitId?: string | null;
  unitId?: string | null;
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

async function loadLinkableProjects(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  portfolioArgs: Record<string, unknown>,
): Promise<ProjectSelectorOption[]> {
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

  return projects;
}

export async function loadProjectPickerOptions(
  targetSearch?: string | null,
  scope?: ProjectPickerScope,
): Promise<ProjectPickerOptions> {
  const supabase = await createServerSupabaseClient();
  const recordSiteUnitId = scope?.siteUnitId?.trim() || null;
  const selectorOptions = await loadSiteScopedSelectorOptions({
    requireConcreteSite: !recordSiteUnitId,
  });

  if (selectorOptions.requiresSiteSelection && !recordSiteUnitId) {
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

  const sessionSiteId =
    selectorOptions.context.mode === "site"
      ? selectorOptions.context.activeSiteId
      : null;
  const siteUnitId = recordSiteUnitId ?? sessionSiteId;
  if (siteUnitId) {
    portfolioArgs.target_site_unit_id = siteUnitId;
  }
  if (scope?.unitId) {
    portfolioArgs.target_unit_id = scope.unitId;
  }

  let projects = await loadLinkableProjects(supabase, portfolioArgs);

  if (projects.length === 0 && siteUnitId && !recordSiteUnitId) {
    const { target_site_unit_id: _omit, ...withoutSite } = portfolioArgs;
    projects = await loadLinkableProjects(supabase, withoutSite);
  }

  return {
    projects,
    requiresSiteSelection: false,
  };
}
