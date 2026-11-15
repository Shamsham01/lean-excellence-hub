"use client";

import { Label } from "@/components/ui/label";
import { ProjectLinkPicker } from "@/components/projects/project-link-picker";
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
      <Label htmlFor="project-source-select">Linked project</Label>
      <ProjectLinkPicker
        id="project-source-select"
        options={options}
        value={value || null}
        onChange={(next) => {
          if (next) onChange(next);
        }}
        disabled={disabled}
        placeholder="Select a project…"
      />
      {options.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="project-select-no-matches"
        >
          No projects match your current scope.
        </p>
      ) : null}
    </div>
  );
}
