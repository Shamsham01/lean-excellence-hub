"use client";

import { Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileSettingsSection({
  title,
  children,
  editTargetId,
  editLabel = "Edit",
}: {
  title: string;
  children: ReactNode;
  editTargetId?: string;
  editLabel?: string;
}) {
  function scrollToEdit() {
    if (!editTargetId) return;
    document
      .getElementById(editTargetId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    const focusable = document
      .getElementById(editTargetId)
      ?.querySelector<HTMLElement>(
        "input, textarea, button, select, [tabindex='0']",
      );
    focusable?.focus();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        divided
        className="flex-row items-center justify-between gap-3 space-y-0"
      >
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        {editTargetId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={scrollToEdit}
            data-testid={`profile-edit-${editTargetId}`}
          >
            <Pencil className="size-3.5" aria-hidden />
            {editLabel}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}
