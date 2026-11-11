"use client";

import { Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ACTION_SOURCE_FILTERS,
  buildActionListQuery,
  type ActionListFilters,
} from "@/lib/actions/action-filters";
import { ACTION_STATUSES, actionStatusLabel } from "@/lib/actions/status";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

function countActiveFilters(filters: ActionListFilters): number {
  let count = 0;
  if (filters.source !== "all") count += 1;
  if (filters.status) count += 1;
  if (filters.assignee) count += 1;
  if (filters.unit) count += 1;
  if (filters.assessment) count += 1;
  if (filters.pillar) count += 1;
  if (filters.criterion) count += 1;
  return count;
}

export function ActionFiltersPopover({
  filters,
  people,
  units,
  assessments,
  pillars,
  criteria,
  className,
}: {
  filters: ActionListFilters;
  people: Option[];
  units: Option[];
  assessments: Option[];
  pillars: Option[];
  criteria: Option[];
  className?: string;
}) {
  const router = useRouter();
  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  function applyChange(next: Partial<ActionListFilters>) {
    const merged: ActionListFilters = { ...filters, ...next };
    const query = buildActionListQuery(merged);
    router.push(query ? `/platform/actions?${query}` : "/platform/actions");
  }

  const showMaturityContext =
    filters.source === "maturity_assessment" || Boolean(filters.assessment);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("relative gap-1.5", className)}
          data-testid="actions-filter-button"
        >
          <Filter className="size-3.5" aria-hidden />
          Filter &amp; sort
          {activeCount > 0 ? (
            <Badge
              variant="secondary"
              className="ml-0.5 h-5 min-w-5 justify-center px-1.5 text-[10px]"
              data-testid="actions-filter-active-count"
            >
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(100vw-2rem,24rem)] p-4"
        data-testid="actions-filters"
      >
        <div className="grid gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="action-source">Source / module</Label>
            <select
              id="action-source"
              name="source"
              value={filters.source}
              className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
              onChange={(event) =>
                applyChange({
                  source: event.target.value as ActionListFilters["source"],
                })
              }
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
              value={filters.status ?? ""}
              className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
              onChange={(event) =>
                applyChange({
                  status: event.target.value.trim() || null,
                })
              }
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
              value={filters.assignee ?? ""}
              className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
              onChange={(event) =>
                applyChange({
                  assignee: event.target.value.trim() || null,
                })
              }
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
              value={filters.unit ?? ""}
              className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
              onChange={(event) =>
                applyChange({
                  unit: event.target.value.trim() || null,
                })
              }
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
                  value={filters.assessment ?? ""}
                  className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
                  onChange={(event) =>
                    applyChange({
                      assessment: event.target.value.trim() || null,
                    })
                  }
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
                  value={filters.pillar ?? ""}
                  className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
                  onChange={(event) =>
                    applyChange({
                      pillar: event.target.value.trim() || null,
                    })
                  }
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
                  value={filters.criterion ?? ""}
                  className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
                  onChange={(event) =>
                    applyChange({
                      criterion: event.target.value.trim() || null,
                    })
                  }
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
          {activeCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start px-0"
              onClick={() => router.push("/platform/actions")}
              data-testid="actions-clear-filters"
            >
              Clear all filters
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
