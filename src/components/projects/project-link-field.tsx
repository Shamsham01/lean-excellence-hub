"use client";

import { useState } from "react";
import { Link2, Unlink } from "lucide-react";

import { ProjectLinkPicker } from "@/components/projects/project-link-picker";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/alert";
import {
  formatProjectReference,
  isCiProjectLinkableStatus,
  projectStatusLabel,
} from "@/lib/projects/status";
import type {
  ProjectLinkSummary,
  ProjectSelectorOption,
} from "@/lib/projects/types";

type ProjectLinkFieldProps = {
  label?: string;
  linked: ProjectLinkSummary | null;
  options: ProjectSelectorOption[];
  canEdit: boolean;
  requiresSiteSelection?: boolean;
  onLink: (projectId: string) => Promise<{ error?: string }>;
  onUnlink: () => Promise<{ error?: string }>;
  testId?: string;
};

export function ProjectLinkField({
  label = "CI project",
  linked,
  options,
  canEdit,
  requiresSiteSelection = false,
  onLink,
  onUnlink,
  testId = "project-link-field",
}: ProjectLinkFieldProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpenValue, setPickerOpenValue] = useState<string | null>(null);

  const summary = linked;
  const linkMutable =
    !summary ||
    (summary.can_open &&
      summary.status != null &&
      isCiProjectLinkableStatus(summary.status));
  const canChangeLink = canEdit && linkMutable;

  const chipLabel = summary
    ? summary.can_open && summary.project_number && summary.title
      ? `${formatProjectReference(summary.project_number, summary.title)} · ${summary.title}`
      : (summary.title ?? "Linked project (not available here)")
    : null;

  async function handleLink(projectId: string | null) {
    if (!projectId) return;
    setPending(true);
    setError(null);
    const result = await onLink(projectId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPickerOpenValue(null);
  }

  async function handleUnlink() {
    setPending(true);
    setError(null);
    const result = await onUnlink();
    setPending(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {summary ? (
          <Badge
            variant="secondary"
            className="gap-1 font-normal"
            data-testid={`${testId}-chip`}
          >
            <Link2 className="size-3.5 opacity-70" aria-hidden />
            {summary.can_open && summary.href ? (
              <AppLink
                href={summary.href}
                className="hover:underline"
                data-testid={`${testId}-chip-link`}
              >
                {chipLabel}
              </AppLink>
            ) : (
              <span>{chipLabel}</span>
            )}
            {summary.status ? (
              <span className="text-muted-foreground">
                · {projectStatusLabel(summary.status)}
              </span>
            ) : null}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Not linked</span>
        )}
        {canChangeLink && summary ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-muted-foreground"
            disabled={pending}
            onClick={() => void handleUnlink()}
            data-testid={`${testId}-unlink`}
          >
            <Unlink className="size-3.5" aria-hidden />
            Unlink
          </Button>
        ) : null}
      </div>

      {summary && !linkMutable ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid={`${testId}-frozen`}
        >
          Link is read-only because this project is completed or cancelled.
        </p>
      ) : null}

      {canChangeLink && !summary ? (
        requiresSiteSelection && options.length === 0 ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid={`${testId}-needs-site`}
          >
            Select an active site in the sidebar before linking a project.
          </p>
        ) : options.length === 0 ? (
          <>
            <p
              className="text-sm text-muted-foreground"
              data-testid={`${testId}-no-projects`}
            >
              No live projects in your current scope. Try another site or create
              a project first.
            </p>
            <ProjectLinkPicker
              options={options}
              value={pickerOpenValue}
              onChange={(next) => {
                setPickerOpenValue(next);
                if (next) void handleLink(next);
              }}
              disabled
            />
          </>
        ) : (
          <ProjectLinkPicker
            options={options}
            value={pickerOpenValue}
            onChange={(next) => {
              setPickerOpenValue(next);
              if (next) void handleLink(next);
            }}
            disabled={pending}
          />
        )
      ) : null}

      {error ? (
        <InlineAlert tone="error" data-testid={`${testId}-error`}>
          {error}
        </InlineAlert>
      ) : null}
    </div>
  );
}
