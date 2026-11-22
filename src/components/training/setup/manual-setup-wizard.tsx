"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createManualTrainingSetupDraft,
  saveTrainingSetupPreparation,
} from "@/app/(platform)/platform/training/setup/actions";
import { useSerializedSetupSave } from "@/components/skills/setup/serialized-save";
import { ModuleWriteButton } from "@/components/billing/module-write-button";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { manualPreparationToDefinition } from "@/modules/training/setup/preparation";
import type { ManualTrainingPreparation } from "@/modules/training/setup/preparation";

import { TrainingTerminologyNote } from "./training-terminology";

const STEPS = ["courses", "curriculum", "preview"] as const;

export function ManualTrainingSetupWizard({
  initial,
  existingCourseCodes,
  existingCurriculumCodes,
}: {
  initial: ManualTrainingPreparation;
  existingCourseCodes: string[];
  existingCurriculumCodes: string[];
}) {
  const [state, setState] = useState(initial);
  const [bulk, setBulk] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const enqueue = useSerializedSetupSave();
  const stepIndex = Math.max(0, STEPS.indexOf(state.step));

  const preview = useMemo(
    () =>
      manualPreparationToDefinition(
        state,
        existingCourseCodes,
        existingCurriculumCodes,
      ),
    [state, existingCourseCodes, existingCurriculumCodes],
  );

  function persist(next: ManualTrainingPreparation) {
    setState(next);
    setError(null);
    startTransition(async () => {
      await enqueue(async () => {
        const result = await saveTrainingSetupPreparation({
          source: "manual",
          state: next,
        });
        if ("error" in result && result.error) {
          setError(result.error);
        }
      });
    });
  }

  function addBulkCourses() {
    const rows = bulk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (rows.length === 0) return;
    persist({
      ...state,
      courses: [
        ...state.courses.filter((course) => course.name.trim()),
        ...rows.map((name) => ({
          name,
          category: "",
          description: "",
          durationMinutes: "",
          deliveryMethod: "",
          learningObjectives: "",
        })),
      ].slice(0, 24),
    });
    setBulk("");
  }

  return (
    <div
      className="flex min-w-0 flex-col gap-8"
      data-testid="training-manual-setup"
    >
      <TrainingTerminologyNote />
      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        {STEPS.map((step, index) => (
          <span
            key={step}
            className={index === stepIndex ? "font-medium text-foreground" : ""}
          >
            {index + 1}. {step}
          </span>
        ))}
      </div>

      {state.step === "courses" ? (
        <section className="flex max-w-3xl flex-col gap-4">
          <SetupErrorAlert error={error} />
          <div>
            <Label htmlFor="training-setup-title">Draft title</Label>
            <Input
              id="training-setup-title"
              className="mt-2"
              value={state.title}
              onChange={(event) =>
                persist({ ...state, title: event.target.value })
              }
              data-testid="training-setup-title"
            />
          </div>
          <div>
            <Label htmlFor="training-bulk-courses">
              Add course names (one per line)
            </Label>
            <Textarea
              id="training-bulk-courses"
              className="mt-2"
              value={bulk}
              onChange={(event) => setBulk(event.target.value)}
              rows={4}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={addBulkCourses}
            >
              Add courses
            </Button>
          </div>
          <ul className="flex flex-col gap-2">
            {state.courses.map((course, index) => (
              <li
                key={`${course.name}-${index}`}
                className="rounded-md border border-border p-3"
              >
                <Input
                  value={course.name}
                  placeholder="Course name"
                  onChange={(event) => {
                    const courses = [...state.courses];
                    courses[index] = { ...course, name: event.target.value };
                    persist({ ...state, courses });
                  }}
                  data-testid={index === 0 ? "training-course-name" : undefined}
                />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => persist({ ...state, step: "curriculum" })}
            >
              Continue
            </Button>
            <Button variant="outline" asChild>
              <AppLink href="/platform/training/setup">Back</AppLink>
            </Button>
          </div>
        </section>
      ) : null}

      {state.step === "curriculum" ? (
        <section className="flex max-w-3xl flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.includeCurriculum}
              onChange={(event) =>
                persist({ ...state, includeCurriculum: event.target.checked })
              }
            />
            Add an empty curriculum shell (requirements can be added after
            publish)
          </label>
          {state.includeCurriculum ? (
            <>
              <SetupErrorAlert error={error} />
              <div>
                <Label htmlFor="training-curriculum-name">
                  Curriculum name
                </Label>
                <Input
                  id="training-curriculum-name"
                  className="mt-2"
                  value={state.curriculumName}
                  onChange={(event) =>
                    persist({ ...state, curriculumName: event.target.value })
                  }
                />
              </div>
              <Textarea
                value={state.curriculumDescription}
                onChange={(event) =>
                  persist({
                    ...state,
                    curriculumDescription: event.target.value,
                  })
                }
                placeholder="Description (optional)"
                rows={3}
              />
            </>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => persist({ ...state, step: "preview" })}
            >
              Preview draft
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => persist({ ...state, step: "courses" })}
            >
              Back
            </Button>
          </div>
        </section>
      ) : null}

      {state.step === "preview" ? (
        <section className="flex max-w-3xl flex-col gap-4">
          {preview.ok ? (
            <p className="text-sm text-muted-foreground">
              {preview.definition.courses.length} course
              {preview.definition.courses.length === 1 ? "" : "s"}
              {preview.definition.curriculum ? " and a curriculum shell" : ""} ·
              draft only
            </p>
          ) : (
            <p
              className="text-sm text-destructive"
              data-testid="training-setup-error"
            >
              {preview.message}
            </p>
          )}
          <div className="flex gap-2">
            <ModuleWriteButton
              type="button"
              disabled={pending || !preview.ok}
              data-testid="training-create-draft"
              onClick={() => {
                startTransition(async () => {
                  const result = await createManualTrainingSetupDraft(state);
                  if (result && "error" in result) {
                    setError(result.error ?? null);
                  }
                });
              }}
            >
              Create draft
            </ModuleWriteButton>
            <Button
              variant="outline"
              type="button"
              onClick={() => persist({ ...state, step: "curriculum" })}
            >
              Back
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SetupErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="text-sm text-destructive"
      data-testid="training-setup-error"
    >
      {error}
    </p>
  );
}
