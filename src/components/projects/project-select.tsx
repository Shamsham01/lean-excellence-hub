"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatProjectReference } from "@/lib/projects/status";
import type { ProjectSelectorOption } from "@/lib/projects/types";

type ProjectSelectProps = {
  options: ProjectSelectorOption[];
  value: string;
  onChange: (projectId: string) => void;
  disabled?: boolean;
  requiresSiteSelection?: boolean;
};

export function ProjectSelect({
  options,
  value,
  onChange,
  disabled = false,
  requiresSiteSelection = false,
}: ProjectSelectProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => {
      const haystack =
        `${option.project_number} ${option.title} ${option.status}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [options, search]);

  if (requiresSiteSelection && options.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid="project-select-empty"
      >
        Select an active site in the sidebar before choosing a project.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="project-select">
      <Label htmlFor="project-source-search">Search projects</Label>
      <Input
        id="project-source-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by number or title"
        disabled={disabled}
        data-testid="project-select-search"
      />
      <Label htmlFor="project-source-select">Linked project</Label>
      <select
        id="project-source-select"
        className="border-input min-h-11 rounded-md border bg-background px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        data-testid="project-select-input"
      >
        <option value="">Select a project…</option>
        {filtered.map((option) => (
          <option key={option.id} value={option.id}>
            {formatProjectReference(option.project_number, option.title)} ·{" "}
            {option.title}
          </option>
        ))}
      </select>
      {filtered.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="project-select-no-matches"
        >
          No projects match that search in your current scope.
        </p>
      ) : null}
    </div>
  );
}
