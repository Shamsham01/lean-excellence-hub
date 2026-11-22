"use client";

import { useId } from "react";

import { ProjectLinkPicker } from "@/components/projects/project-link-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ProjectPickerOptions } from "@/lib/projects/load-project-picker-options";
import {
  ACTION_PROJECT_EMPTY_HINT,
  actionProjectStatusHint,
  isActionProjectStatus,
} from "@/lib/projects/status";

export function ActionProjectPicker({
  picker,
  value,
  onChange,
  disabled,
}: {
  picker: ProjectPickerOptions;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const hasOptions = picker.projects.some((project) =>
    isActionProjectStatus(project.status),
  );
  const selected = picker.projects.find((project) => project.id === value);
  const hint = selected && actionProjectStatusHint(selected.status);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>CI project (optional)</Label>
      {hasOptions ? (
        <div className="flex items-center gap-2">
          <ProjectLinkPicker
            forAction
            id={id}
            aria-label="CI project (optional)"
            className="min-w-0 flex-1"
            options={picker.projects}
            value={value}
            onChange={onChange}
            disabled={disabled ?? false}
          />
          {value ? (
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              Clear
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {picker.requiresSiteSelection
            ? "Select an active site in the sidebar before linking a project."
            : ACTION_PROJECT_EMPTY_HINT}
        </p>
      )}
      {hint ? (
        <p
          className={
            selected?.status === "on_hold"
              ? "text-xs text-warning-foreground"
              : "text-xs text-muted-foreground"
          }
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
