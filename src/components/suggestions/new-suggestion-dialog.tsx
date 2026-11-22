"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ModuleWriteButton } from "@/components/billing/module-write-button";
import { NewSuggestionForm } from "@/components/suggestions/new-suggestion-form";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useDialogDefaultOpen } from "@/components/ui/use-dialog-default-open";
import { usePlanModuleWriteAllowed } from "@/modules/billing/module-write-context";
import type { NewSuggestionFormConfiguration } from "@/lib/suggestions/load-new-suggestion-configuration";
import { Card, CardContent } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/platform/supabase/browser";

type NewSuggestionDialogProps = {
  canManageProgrammes: boolean;
  canManageJobFunctions: boolean;
  triggerLabel?: string;
  defaultOpen?: boolean;
  showTrigger?: boolean;
};

type LoadedConfiguration = Omit<
  NewSuggestionFormConfiguration,
  "canManageProgrammes"
>;

async function loadConfigurationClient(
  canManageJobFunctions: boolean,
): Promise<LoadedConfiguration> {
  const supabase = createBrowserSupabaseClient();
  const [{ data: configurationData, error: configurationError }, primaryRes] =
    await Promise.all([
      supabase.rpc("get_available_suggestion_submission_configuration"),
      supabase.rpc("get_current_membership_primary_unit"),
    ]);

  let loadError: string | null = null;
  let programmesForForm: Array<{ id: string; programme_name: string }> = [];
  let categoriesForForm: Array<{ id: string; name: string }> = [];

  if (configurationError) {
    loadError = "Unable to load suggestion configuration.";
  } else {
    const configuration = configurationData as {
      programmes?: Array<{
        programme_version_id: string;
        programme_name: string;
      }>;
      categories?: Array<{ category_id: string; category_name: string }>;
    } | null;
    programmesForForm =
      configuration?.programmes?.map((programme) => ({
        id: programme.programme_version_id,
        programme_name: programme.programme_name,
      })) ?? [];
    categoriesForForm =
      configuration?.categories?.map((category) => ({
        id: category.category_id,
        name: category.category_name,
      })) ?? [];
  }

  const primaryUnit = primaryRes.data as {
    has_primary_unit?: boolean;
    unit_name?: string;
    membership_id?: string;
  } | null;

  return {
    loadError,
    programmesForForm,
    categoriesForForm,
    primaryUnit: {
      hasPrimaryUnit: primaryUnit?.has_primary_unit === true,
      canManageAssignment: canManageJobFunctions,
      ...(primaryUnit?.membership_id
        ? { membershipId: primaryUnit.membership_id }
        : {}),
      ...(primaryUnit?.unit_name ? { unitName: primaryUnit.unit_name } : {}),
    },
  };
}

export function NewSuggestionDialog({
  canManageProgrammes,
  canManageJobFunctions,
  triggerLabel = "New suggestion",
  defaultOpen = false,
  showTrigger = true,
}: NewSuggestionDialogProps) {
  const router = useRouter();
  const writeAllowed = usePlanModuleWriteAllowed();
  const [open, setOpen] = useDialogDefaultOpen(defaultOpen);
  const [configuration, setConfiguration] =
    useState<LoadedConfiguration | null>(null);
  const [loading, setLoading] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadConfigurationClient(canManageJobFunctions);
      setConfiguration(next);
    } finally {
      setLoading(false);
    }
  }, [canManageJobFunctions]);

  const defaultLoadStarted = useRef(false);

  useEffect(() => {
    if (!defaultOpen || !writeAllowed || defaultLoadStarted.current) {
      return;
    }
    defaultLoadStarted.current = true;
    void loadConfig();
  }, [defaultOpen, loadConfig, writeAllowed]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        setConfiguration(null);
        return;
      }
      if (!configuration && !loading) {
        void loadConfig();
      }
    },
    [configuration, loadConfig, loading],
  );

  function handleSuccess() {
    setOpen(false);
    setConfiguration(null);
    router.refresh();
  }

  return (
    <>
      {showTrigger ? (
        <ModuleWriteButton
          type="button"
          size="sm"
          className="min-h-11"
          data-testid="suggestions-new-link"
          onClick={() => handleOpenChange(true)}
        >
          {triggerLabel}
        </ModuleWriteButton>
      ) : null}
      <ResponsiveFormDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="New suggestion"
        description="Share what you've noticed and what you'd change — takes about a minute."
        testId="suggestions-new-dialog"
        enableGuard
        onGuardReset={() => setConfiguration(null)}
      >
        {loading || !configuration ? (
          <p className="text-sm text-muted-foreground">Loading form…</p>
        ) : configuration.loadError ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              {configuration.loadError}
            </CardContent>
          </Card>
        ) : (
          <NewSuggestionForm
            variant="embedded"
            programmeVersions={configuration.programmesForForm}
            categories={configuration.categoriesForForm}
            canManageProgrammes={canManageProgrammes}
            primaryUnit={configuration.primaryUnit}
            onSubmitted={handleSuccess}
          />
        )}
      </ResponsiveFormDialog>
    </>
  );
}
