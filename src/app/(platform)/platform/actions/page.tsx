import { Suspense } from "react";

import { ActionCreateForm } from "@/components/actions/action-create-form";
import { WorkplaceSharedRecords } from "@/components/workplace/workplace-shared-records";
import { ActionFilters } from "@/components/actions/action-filters";
import { ActionPlannerShell } from "@/components/actions/action-planner-shell";
import { ModuleAnalyticsDashboard } from "@/components/platform/module-analytics-dashboard";
import { ACTION_ANALYTICS_ICONS } from "@/components/platform/module-analytics-icons";
import { PageHeader } from "@/components/platform/page-header";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  buildAnalyticsDateRange,
  parseAnalyticsRangeDays,
} from "@/modules/platform-analytics/date-range";
import { loadActionsAnalytics } from "@/modules/platform-analytics/actions";
import { parseActionListFilters } from "@/lib/actions/action-filters";
import { loadActionPlannerSummaries } from "@/lib/actions/load-planner-summaries";
import { loadSiteScopedSelectorOptions } from "@/lib/organisation/selector-options";
import { ACTIONS_PERMISSIONS } from "@/modules/operational/permissions";
import { currentMemberHasPermission } from "@/modules/platform-shell/permissions";
import { loadWorkplaceModuleView } from "@/modules/workplace/access";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const workplaceView = await loadWorkplaceModuleView({
    readPermission: ACTIONS_PERMISSIONS.read,
    module: "actions",
    title: "Actions",
    baselineOpensModule: true,
  });
  if (workplaceView) return workplaceView;

  const canCreate = await currentMemberHasPermission(
    ACTIONS_PERMISSIONS.create,
  );
  const rawParams = await searchParams;
  const analyticsRange = buildAnalyticsDateRange(
    parseAnalyticsRangeDays(rawParams.range),
  );
  const filters = parseActionListFilters(rawParams);
  const selectorOptions = await loadSiteScopedSelectorOptions();
  const supabase = await createServerSupabaseClient();

  const sourceActionIds = await loadSourceActionIds(supabase, filters);

  let actionQuery = supabase
    .from("actions")
    .select(
      "id, action_number, title, status, priority, created_at, due_at, unit_id, source_resource_id, version",
    )
    .order("created_at", { ascending: false });

  if (filters.status) {
    actionQuery = actionQuery.eq("status", filters.status);
  }
  if (filters.unit) {
    actionQuery = actionQuery.eq("unit_id", filters.unit);
  }

  let actions: Array<{
    id: string;
    action_number: string | null;
    title: string;
    status: string;
    priority: string;
    created_at: string;
    due_at: string | null;
    version: number;
  }> = [];

  if (sourceActionIds && sourceActionIds.length === 0) {
    actions = [];
  } else {
    if (sourceActionIds) {
      actionQuery = actionQuery.in("id", sourceActionIds);
    }
    const { data } = await actionQuery;
    actions = data ?? [];
  }

  const { data: assessmentRows } = await supabase
    .from("maturity_assessments")
    .select("id, assessment_type, status")
    .order("updated_at", { ascending: false });
  const { data: pillarRows } = await supabase
    .from("maturity_pillars")
    .select("id, name")
    .order("name");
  const { data: criterionRows } = await supabase
    .from("maturity_criteria")
    .select("id, name")
    .order("name");

  const analytics = await loadActionsAnalytics(supabase, analyticsRange);

  const plannerActions = await loadActionPlannerSummaries(actions);
  const openActionParam =
    typeof rawParams.action === "string"
      ? rawParams.action
      : Array.isArray(rawParams.action)
        ? rawParams.action[0]
        : undefined;
  const openActionId = openActionParam ?? null;

  return (
    <div className="flex flex-col gap-8" data-testid="actions-page">
      <PageHeader
        title="Actions"
        description="Improvement actions linked to assessments and operational work."
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Platform", href: "/platform" },
              { label: "Actions" },
            ]}
          />
        }
      />

      <ModuleAnalyticsDashboard
        snapshot={analytics}
        icons={ACTION_ANALYTICS_ICONS}
        testId="actions-analytics"
        showAgeingTable={false}
      />

      <ActionFilters
        filters={filters}
        people={selectorOptions.people}
        units={selectorOptions.units.map((unit) => ({
          id: unit.id,
          label: unit.name,
        }))}
        assessments={(assessmentRows ?? []).map((assessment) => ({
          id: assessment.id,
          label: `${assessment.assessment_type} · ${assessment.status}`,
        }))}
        pillars={(pillarRows ?? []).map((pillar) => ({
          id: pillar.id,
          label: pillar.name,
        }))}
        criteria={(criterionRows ?? []).map((criterion) => ({
          id: criterion.id,
          label: criterion.name,
        }))}
      />

      {canCreate ? <ActionCreateForm /> : null}

      <Suspense fallback={null}>
        <ActionPlannerShell
          actions={plannerActions}
          initialOpenActionId={openActionId}
          canCreate={canCreate}
        />
      </Suspense>
      <WorkplaceSharedRecords module="actions" title="Actions" />
    </div>
  );
}

async function loadSourceActionIds(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  filters: ReturnType<typeof parseActionListFilters>,
): Promise<string[] | null> {
  const sets: string[][] = [];

  if (filters.source === "maturity_assessment" || filters.assessment) {
    let contextQuery = supabase
      .from("maturity_action_context")
      .select("action_id, assessment_id, pillar_id, criterion_id");
    if (filters.assessment) {
      contextQuery = contextQuery.eq("assessment_id", filters.assessment);
    }
    if (filters.pillar) {
      contextQuery = contextQuery.eq("pillar_id", filters.pillar);
    }
    if (filters.criterion) {
      contextQuery = contextQuery.eq("criterion_id", filters.criterion);
    }
    const { data } = await contextQuery;
    sets.push((data ?? []).map((row) => row.action_id));
  } else if (filters.source === "standalone") {
    const { data } = await supabase
      .from("actions")
      .select("id, source_resource_id");
    sets.push(
      (data ?? [])
        .filter((row) => row.source_resource_id == null)
        .map((row) => row.id),
    );
  } else if (filters.source === "problem_solving_case") {
    const { data } = await supabase
      .from("problem_solving_action_context")
      .select("action_id");
    sets.push((data ?? []).map((row) => row.action_id));
  } else if (filters.source === "ci_project") {
    const { data } = await supabase
      .from("ci_project_action_context")
      .select("action_id");
    sets.push((data ?? []).map((row) => row.action_id));
  } else if (filters.source === "improvement_suggestion") {
    const { data } = await supabase
      .from("suggestion_action_context")
      .select("action_id");
    sets.push((data ?? []).map((row) => row.action_id));
  } else if (filters.source === "five_s_audit") {
    const { data } = await supabase
      .from("five_s_action_context")
      .select("action_id");
    sets.push((data ?? []).map((row) => row.action_id));
  } else if (filters.source === "gemba_walk") {
    const { data } = await supabase
      .from("gemba_action_context")
      .select("action_id");
    sets.push((data ?? []).map((row) => row.action_id));
  }

  if (filters.assignee) {
    const { data } = await supabase
      .from("action_assignees")
      .select("action_id")
      .eq("membership_id", filters.assignee);
    sets.push((data ?? []).map((row) => row.action_id));
  }

  if (sets.length === 0) {
    return null;
  }

  return intersectIds(sets);
}

function intersectIds(sets: string[][]): string[] {
  if (sets.length === 0) return [];
  const [first, ...rest] = sets;
  const remaining = new Set(first);
  for (const next of rest) {
    const nextSet = new Set(next);
    for (const id of remaining) {
      if (!nextSet.has(id)) {
        remaining.delete(id);
      }
    }
  }
  return [...remaining];
}
