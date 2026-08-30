"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { MetricCard } from "@/components/platform/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  portfolioFilterStatuses,
  problemSolvingStatusBadgeVariant,
  problemSolvingStatusLabel,
  severityLabel,
  SEVERITIES,
} from "@/lib/problem-solving/status";
import type {
  ProblemSolvingOverview,
  ProblemSolvingPortfolioItem,
} from "@/lib/problem-solving/types";

type CasePortfolioProps = {
  items: ProblemSolvingPortfolioItem[];
  totalCount: number;
  overview: ProblemSolvingOverview | null;
  statusFilter: string | null;
  searchFilter: string | null;
  severityFilter: string | null;
  canCreate: boolean;
};

export function CasePortfolio({
  items,
  totalCount,
  overview,
  statusFilter,
  searchFilter,
  severityFilter,
  canCreate,
}: CasePortfolioProps) {
  const router = useRouter();

  const pipeline = overview?.status_pipeline ?? {};
  const severity = overview?.severity_breakdown ?? {};

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams();
    const status = formData.get("status")?.toString();
    const search = formData.get("search")?.toString();
    const severityValue = formData.get("severity")?.toString();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    if (severityValue) params.set("severity", severityValue);
    const query = params.toString();
    router.push(
      query
        ? `/platform/problem-solving?${query}`
        : "/platform/problem-solving",
    );
  }

  return (
    <div
      className="flex flex-col gap-6"
      data-testid="problem-solving-portfolio"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Active" value={pipeline.active ?? 0} />
        <MetricCard label="Draft" value={pipeline.draft ?? 0} />
        <MetricCard label="Closed" value={pipeline.closed ?? 0} />
        <MetricCard
          label="Verified causes"
          value={overview?.cases_with_verified_causes ?? 0}
          hint={`${overview?.active_cases ?? 0} open cases`}
        />
        <MetricCard
          label="Effective countermeasures"
          value={overview?.cases_with_effective_countermeasures ?? 0}
        />
        <MetricCard
          label="Critical / major"
          value={(severity.critical ?? 0) + (severity.major ?? 0)}
          hint={`${severity.minor ?? 0} minor · ${severity.moderate ?? 0} moderate`}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Case portfolio</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalCount} cases
            </p>
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
                data-testid="problem-solving-portfolio-search"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:w-40">
              <span className="text-muted-foreground">Status</span>
              <select
                name="status"
                defaultValue={statusFilter ?? ""}
                className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
                data-testid="problem-solving-portfolio-status"
              >
                <option value="">All statuses</option>
                {portfolioFilterStatuses().map((status) => (
                  <option key={status} value={status}>
                    {problemSolvingStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:w-40">
              <span className="text-muted-foreground">Severity</span>
              <select
                name="severity"
                defaultValue={severityFilter ?? ""}
                className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
              >
                <option value="">All severities</option>
                {SEVERITIES.map((value) => (
                  <option key={value} value={value}>
                    {severityLabel(value)}
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
            <div
              className="rounded-lg border border-dashed border-border px-4 py-10 text-center"
              data-testid="problem-solving-empty-state"
            >
              {statusFilter || searchFilter || severityFilter ? (
                <>
                  <p className="text-sm font-medium">
                    No cases match your filters
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Adjust search or filters
                    {canCreate
                      ? ", or register a new problem solving case."
                      : "."}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    {canCreate
                      ? "No problem-solving cases yet"
                      : "No problem-solving cases are currently available in your scope"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {canCreate
                      ? "Register a new case to start structured root cause analysis."
                      : "Cases shared within your access scope will appear here when they are available."}
                  </p>
                </>
              )}
              {canCreate ? (
                <Button size="sm" className="mt-4" asChild>
                  <Link href="/platform/problem-solving/new">New case</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={`/platform/problem-solving/${item.id}`}
                className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                data-testid={`problem-solving-portfolio-item-${item.id}`}
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.case_number ? `${item.case_number} · ` : ""}
                    {item.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {severityLabel(item.severity)}
                    {item.verified_hypothesis_count > 0
                      ? ` · ${item.verified_hypothesis_count} verified cause(s)`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={problemSolvingStatusBadgeVariant(item.status)}
                  >
                    {problemSolvingStatusLabel(item.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {item.hypothesis_count} hypotheses ·{" "}
                    {item.countermeasure_count} countermeasures
                    {item.open_action_count > 0
                      ? ` · ${item.open_action_count} open actions`
                      : ""}
                  </span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
