"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { MetricCard } from "@/components/platform/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { computePortfolioMetrics } from "@/lib/projects/portfolio-metrics";
import {
  portfolioFilterStatuses,
  projectPriorityLabel,
  projectStatusBadgeVariant,
  projectStatusLabel,
} from "@/lib/projects/status";
import type { ProjectPortfolioItem, ProjectPortfolioMetrics } from "@/lib/projects/types";

type ProjectPortfolioProps = {
  items: ProjectPortfolioItem[];
  totalCount: number;
  metrics: ProjectPortfolioMetrics;
  statusFilter: string | null;
  searchFilter: string | null;
  canManage: boolean;
};

export function ProjectPortfolio({
  items,
  totalCount,
  metrics,
  statusFilter,
  searchFilter,
  canManage,
}: ProjectPortfolioProps) {
  const router = useRouter();
  const computed = computePortfolioMetrics(items, metrics.openActions, metrics.meetingTarget);

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams();
    const status = formData.get("status")?.toString();
    const search = formData.get("search")?.toString();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const query = params.toString();
    router.push(query ? `/platform/projects?${query}` : "/platform/projects");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Active" value={computed.active} />
        <MetricCard label="On hold" value={computed.onHold} />
        <MetricCard label="Overdue" value={computed.overdue} />
        <MetricCard label="Completed YTD" value={computed.completedYtd} />
        <MetricCard label="Meeting target" value={computed.meetingTarget} />
        <MetricCard label="Open actions" value={computed.openActions} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Project portfolio</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{totalCount} projects</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters(new FormData(event.currentTarget));
            }}
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end"
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:min-w-[200px]">
              <span className="text-muted-foreground">Search</span>
              <Input
                name="search"
                defaultValue={searchFilter ?? ""}
                placeholder="Number or title"
                className="min-h-11"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:w-40">
              <span className="text-muted-foreground">Status</span>
              <select
                name="status"
                defaultValue={statusFilter ?? ""}
                className="min-h-11 rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">All statuses</option>
                {portfolioFilterStatuses().map((status) => (
                  <option key={status} value={status}>
                    {projectStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline" className="min-h-11">
              Apply
            </Button>
          </form>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 pt-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium">No projects match your filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust search or status, or create a new improvement project.
              </p>
              {canManage ? (
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/platform/projects/new">New project</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={`/platform/projects/${item.id}`}
                className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {item.project_number} · {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.planned_start_date
                      ? `Planned ${item.planned_start_date}`
                      : "No planned dates"}
                    {item.planned_end_date ? ` – ${item.planned_end_date}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Badge variant={projectStatusBadgeVariant(item.status)}>
                    {projectStatusLabel(item.status)}
                  </Badge>
                  <Badge variant="outline">{projectPriorityLabel(item.priority)}</Badge>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
