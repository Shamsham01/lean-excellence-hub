"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ACTION_SOURCE_FILTERS,
  buildActionListQuery,
  type ActionListFilters,
} from "@/lib/actions/action-filters";
import { ACTION_STATUSES, actionStatusLabel } from "@/lib/actions/status";

type Option = { id: string; label: string };

export function ActionFilters({
  filters,
  people,
  units,
  assessments,
  pillars,
  criteria,
}: {
  filters: ActionListFilters;
  people: Option[];
  units: Option[];
  assessments: Option[];
  pillars: Option[];
  criteria: Option[];
}) {
  const router = useRouter();

  function apply(formData: FormData) {
    const next = {
      source: String(
        formData.get("source") || "all",
      ) as ActionListFilters["source"],
      status: String(formData.get("status") || "").trim() || null,
      assignee: String(formData.get("assignee") || "").trim() || null,
      unit: String(formData.get("unit") || "").trim() || null,
      assessment: String(formData.get("assessment") || "").trim() || null,
      pillar: String(formData.get("pillar") || "").trim() || null,
      criterion: String(formData.get("criterion") || "").trim() || null,
    };
    const query = buildActionListQuery(next);
    router.push(query ? `/platform/actions?${query}` : "/platform/actions");
  }

  const showMaturityContext =
    filters.source === "maturity_assessment" || Boolean(filters.assessment);

  return (
    <form
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="actions-filters"
      onSubmit={(event) => {
        event.preventDefault();
        apply(new FormData(event.currentTarget));
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="action-source">Source / module</Label>
        <select
          id="action-source"
          name="source"
          defaultValue={filters.source}
          className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          {ACTION_SOURCE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="action-status">Status</Label>
        <select
          id="action-status"
          name="status"
          defaultValue={filters.status ?? ""}
          className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          {ACTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {actionStatusLabel(status)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="action-assignee">Assignee</Label>
        <select
          id="action-assignee"
          name="assignee"
          defaultValue={filters.assignee ?? ""}
          className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All assignees</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="action-unit">Site / unit</Label>
        <select
          id="action-unit"
          name="unit"
          defaultValue={filters.unit ?? ""}
          className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All units</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
            </option>
          ))}
        </select>
      </div>
      {showMaturityContext ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="action-assessment">Assessment</Label>
            <select
              id="action-assessment"
              name="assessment"
              defaultValue={filters.assessment ?? ""}
              className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">All assessments</option>
              {assessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="action-pillar">Pillar</Label>
            <select
              id="action-pillar"
              name="pillar"
              defaultValue={filters.pillar ?? ""}
              className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">All pillars</option>
              {pillars.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="action-criterion">Criterion</Label>
            <select
              id="action-criterion"
              name="criterion"
              defaultValue={filters.criterion ?? ""}
              className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">All criteria</option>
              {criteria.map((criterion) => (
                <option key={criterion.id} value={criterion.id}>
                  {criterion.label}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      <div className="flex items-end">
        <Button type="submit" variant="outline">
          Apply filters
        </Button>
      </div>
    </form>
  );
}
