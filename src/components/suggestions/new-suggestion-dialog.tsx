"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { NewSuggestionForm } from "@/components/suggestions/new-suggestion-form";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import type { NewSuggestionFormConfiguration } from "@/lib/suggestions/load-new-suggestion-configuration";
import { Card, CardContent } from "@/components/ui/card";

type NewSuggestionDialogProps = NewSuggestionFormConfiguration & {
  triggerLabel?: string;
  defaultOpen?: boolean;
  showTrigger?: boolean;
};

export function NewSuggestionDialog({
  loadError,
  programmesForForm,
  categoriesForForm,
  primaryUnit,
  canManageProgrammes,
  triggerLabel = "New suggestion",
  defaultOpen = false,
  showTrigger = true,
}: NewSuggestionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {showTrigger ? (
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          data-testid="suggestions-new-link"
          onClick={() => setOpen(true)}
        >
          {triggerLabel}
        </Button>
      ) : null}
      <ResponsiveFormDialog
        open={open}
        onOpenChange={setOpen}
        title="New suggestion"
        description="Share what you've noticed and what you'd change — takes about a minute."
        testId="suggestions-new-dialog"
      >
        {loadError ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              {loadError}
            </CardContent>
          </Card>
        ) : (
          <NewSuggestionForm
            variant="embedded"
            programmeVersions={programmesForForm}
            categories={categoriesForForm}
            canManageProgrammes={canManageProgrammes}
            primaryUnit={primaryUnit}
            onSubmitted={handleSuccess}
          />
        )}
      </ResponsiveFormDialog>
    </>
  );
}
