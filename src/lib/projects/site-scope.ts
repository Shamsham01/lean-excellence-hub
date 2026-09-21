import type { ActiveSiteContext } from "@/modules/organisation/site-context";
import {
  collectDescendantUnitIds,
  type FlatOrganisationUnit,
} from "@/modules/organisation/unit-hierarchy";

export type PortfolioRpcArgs = {
  target_search?: string | null;
  target_status?: string | null;
  target_unit_id?: string | null;
  target_priority?: string | null;
  target_page?: number;
  target_page_size?: number;
  target_site_unit_id?: string | null;
};

/**
 * Applies active-site UX scope to get_ci_projects_portfolio args. Omits the
 * filter for legacy/all-sites modes; RBAC remains authoritative on the RPC.
 */
export function withPortfolioSiteScope<T extends PortfolioRpcArgs>(
  args: T,
  context: ActiveSiteContext,
): T {
  if (context.mode === "site" && context.activeSiteId) {
    return { ...args, target_site_unit_id: context.activeSiteId };
  }

  return args;
}

export type ProjectActionContextRow = {
  action_id: string;
  project_id: string;
};

/**
 * Action IDs linked to projects in the site-scoped metrics portfolio. Returns an
 * empty list when the portfolio has no projects so callers skip DB queries.
 */
export function resolvePortfolioOpenActionIds(
  scopedProjectIds: readonly string[],
  actionContexts: readonly ProjectActionContextRow[],
): string[] {
  if (scopedProjectIds.length === 0) {
    return [];
  }

  const scopedProjectIdSet = new Set(scopedProjectIds);
  const actionIds: string[] = [];
  const seenActionIds = new Set<string>();

  for (const row of actionContexts) {
    if (!scopedProjectIdSet.has(row.project_id)) {
      continue;
    }
    if (seenActionIds.has(row.action_id)) {
      continue;
    }
    seenActionIds.add(row.action_id);
    actionIds.push(row.action_id);
  }

  return actionIds;
}

export type SiteScopedProjectCandidate = {
  unit_id: string;
  site_unit_id?: string | null;
};

/**
 * UX-only active-site filter for project pickers. RBAC remains authoritative via
 * get_ci_projects_portfolio(can_read_ci_project). Prefer target_site_unit_id on
 * the RPC; this helper supports tests and defensive client-side narrowing.
 */
export function filterProjectsForActiveSite<
  T extends SiteScopedProjectCandidate,
>(
  projects: T[],
  units: FlatOrganisationUnit[],
  context: ActiveSiteContext,
  options: { requireConcreteSite?: boolean } = {},
): T[] {
  const requireConcreteSite = options.requireConcreteSite === true;

  if (context.mode === "legacy") {
    return projects;
  }

  if (context.mode === "all") {
    return requireConcreteSite ? [] : projects;
  }

  if (!context.activeSiteId) {
    return requireConcreteSite ? [] : projects;
  }

  const visibleUnitIds = collectDescendantUnitIds(units, context.activeSiteId);

  return projects.filter(
    (project) =>
      project.site_unit_id === context.activeSiteId ||
      visibleUnitIds.has(project.unit_id),
  );
}
