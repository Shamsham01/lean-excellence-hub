"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import {
  ACTION_PROJECT_EMPTY_HINT,
  actionProjectStatusHint,
  actionProjectStatusLabel,
  formatProjectReference,
  isActionProjectStatus,
  projectStatusBadgeVariant,
  projectStatusLabel,
} from "@/lib/projects/status";
import type { ProjectSelectorOption } from "@/lib/projects/types";

type ProjectLinkPickerProps = {
  options: ProjectSelectorOption[];
  forAction?: boolean;
  value: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
};

export function projectOptionLabel(
  option: ProjectSelectorOption,
  forAction = false,
): string {
  const statusLabel = forAction
    ? actionProjectStatusLabel(option.status)
    : projectStatusLabel(option.status);
  return `${formatProjectReference(option.project_number, option.title)} · ${option.title} · ${statusLabel}`;
}

export function ProjectLinkPicker({
  options,
  forAction = false,
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Link to project…",
  id,
  "aria-label": ariaLabel,
}: ProjectLinkPickerProps) {
  const comboboxOptions = useMemo(
    () =>
      options
        .filter((option) => !forAction || isActionProjectStatus(option.status))
        .map((option) => {
          const hint = forAction && actionProjectStatusHint(option.status);
          return {
            value: option.id,
            label: projectOptionLabel(option, forAction),
            ...(forAction && {
              content: (
                <span className="min-w-0 space-y-1 text-left">
                  <span className="flex flex-wrap items-center gap-2">
                    {formatProjectReference(
                      option.project_number,
                      option.title,
                    )}
                    {option.project_number?.trim() ? ` · ${option.title}` : ""}
                    <Badge variant={projectStatusBadgeVariant(option.status)}>
                      {actionProjectStatusLabel(option.status)}
                    </Badge>
                  </span>
                  {hint ? (
                    <span
                      className={
                        option.status === "on_hold"
                          ? "block text-xs text-warning-foreground"
                          : "block text-xs text-muted-foreground"
                      }
                    >
                      {hint}
                    </span>
                  ) : null}
                </span>
              ),
            }),
          };
        }),
    [options, forAction],
  );

  return (
    <div className={className} data-testid="project-link-picker">
      <Combobox
        options={comboboxOptions}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...(id ? { id } : {})}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
        placeholder={placeholder}
        searchPlaceholder="Search code, title, or status"
        emptyHint={
          forAction
            ? ACTION_PROJECT_EMPTY_HINT
            : "No live projects in your current scope. Try another site or create a project first."
        }
      />
    </div>
  );
}
