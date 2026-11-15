"use client";

import { useMemo } from "react";

import { Combobox } from "@/components/ui/combobox";
import {
  formatProjectReference,
  projectStatusLabel,
} from "@/lib/projects/status";
import type { ProjectSelectorOption } from "@/lib/projects/types";

type ProjectLinkPickerProps = {
  options: ProjectSelectorOption[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function projectOptionLabel(option: ProjectSelectorOption): string {
  return `${formatProjectReference(option.project_number, option.title)} · ${option.title} · ${projectStatusLabel(option.status)}`;
}

export function ProjectLinkPicker({
  options,
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Link to project…",
}: ProjectLinkPickerProps) {
  const comboboxOptions = useMemo(
    () =>
      options.map((option) => ({
        value: option.id,
        label: projectOptionLabel(option),
      })),
    [options],
  );

  return (
    <div data-testid="project-link-picker">
      <Combobox
        options={comboboxOptions}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...(className ? { className } : {})}
        placeholder={placeholder}
        searchPlaceholder="Search code, title, or status"
      />
    </div>
  );
}
