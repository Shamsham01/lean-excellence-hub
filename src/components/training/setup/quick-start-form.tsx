"use client";

import { useState, useTransition } from "react";

import {
  deployTrainingQuickStart,
  saveTrainingSetupPreparation,
} from "@/app/(platform)/platform/training/setup/actions";
import { useSerializedSetupSave } from "@/components/skills/setup/serialized-save";
import { Button } from "@/components/ui/button";
import { buildStarterPackDefinition } from "@/modules/training/setup/definition";
import type { QuickStartPreparation } from "@/modules/training/setup/preparation";
import type { TrainingStarterPack } from "@/modules/training/templates/types";

type Named = { id: string; name: string };

export function TrainingQuickStartForm({
  pack,
  initial,
  jobFunctions,
  existingCourseCodes,
  existingCurriculumCodes,
}: {
  pack: TrainingStarterPack;
  initial: QuickStartPreparation;
  jobFunctions: Named[];
  existingCourseCodes: string[];
  existingCurriculumCodes: string[];
}) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const enqueue = useSerializedSetupSave();

  const preview = buildStarterPackDefinition({
    pack,
    roleMappings: state.roleMappings,
    existingCourseCodes,
    existingCurriculumCodes,
  });

  function persist(next: QuickStartPreparation) {
    setState(next);
    setError(null);
    startTransition(async () => {
      await enqueue(async () => {
        const result = await saveTrainingSetupPreparation({
          source: "quick_start",
          templateKey: pack.key,
          state: next,
        });
        if ("error" in result && result.error) {
          setError(result.error);
        }
      });
    });
  }

  return (
    <div
      className="flex max-w-3xl flex-col gap-6"
      data-testid="training-quick-start-form"
    >
      <p className="text-sm text-muted-foreground">{pack.summary}</p>
      <ul className="text-sm">
        {pack.courses.map((course) => (
          <li key={course.name}>{course.name}</li>
        ))}
      </ul>
      <SetupErrorAlert error={error} />
      {state.roleMappings.map((mapping, index) => (
        <div
          key={mapping.suggestedRole}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <span className="min-w-40 text-sm font-medium">
            {mapping.suggestedRole}
          </span>
          <select
            className="min-h-11 rounded-md border border-border bg-background px-3 text-sm"
            value={mapping.jobFunctionId ?? ""}
            onChange={(event) => {
              const roleMappings = [...state.roleMappings];
              roleMappings[index] = {
                ...mapping,
                jobFunctionId: event.target.value || null,
              };
              persist({ ...state, roleMappings });
            }}
            data-testid={`training-role-map-${index}`}
          >
            <option value="">Not mapped</option>
            {jobFunctions.map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </select>
        </div>
      ))}
      {preview.ok ? (
        <p className="text-sm text-muted-foreground">
          {preview.definition.courses.length} courses ·{" "}
          {preview.definition.curriculum?.requirements.length ?? 0} requirements
        </p>
      ) : (
        <p className="text-sm text-destructive">{preview.message}</p>
      )}
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={pending || !preview.ok}
        data-testid="training-quick-start-create"
        onClick={() => {
          startTransition(async () => {
            const result = await deployTrainingQuickStart({
              packKey: pack.key,
              preparation: state,
            });
            if (result && "error" in result) {
              setError(result.error ?? null);
            }
          });
        }}
      >
        Create sample draft
      </Button>
    </div>
  );
}

function SetupErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );
}
