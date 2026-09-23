"use client";

import { useState } from "react";

import {
  addTrainingRequirement,
  publishTrainingCurriculumVersion,
  removeTrainingRequirement,
  updateTrainingRequirement,
} from "@/app/(platform)/platform/training/curriculum-actions";
import {
  CurriculumRequirementForm,
  emptyRequirementFormValues,
  type CurriculumCourseOption,
  type CurriculumNamedOption,
  type CurriculumRequirementFormValues,
} from "@/components/training/curriculum-requirement-form";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAuthoringSavedRedirectPath } from "@/lib/authoring/authoring-query";
import { navigateTo } from "@/lib/navigation/navigate";
import {
  describeTrainingRequirementApplicability,
  resolveTrainingRequirementApplicabilityMode,
  trainingCurriculumPublishGuidance,
  trainingRequirementFormHasUnsavedContent,
} from "@/modules/training/curriculum-admin";
import type { UnitSelectOption } from "@/modules/organisation/site-context";

export type CurriculumDraftRequirement = {
  id: string;
  courseId: string;
  courseName: string;
  appliesToAllMembers: boolean;
  jobFunctionId: string | null;
  jobFunctionName: string | null;
  organisationalUnitId: string | null;
  organisationalUnitName: string | null;
  mandatory: boolean;
  requiredWithinDays: number | null;
  validityDaysOverride: number | null;
  gracePeriodDays: number | null;
  notes: string | null;
};

type CurriculumDraftEditorProps = {
  curriculumId: string;
  versionId: string;
  requirements: readonly CurriculumDraftRequirement[];
  courses: readonly CurriculumCourseOption[];
  jobFunctions: readonly CurriculumNamedOption[];
  units: readonly UnitSelectOption[];
};

function requirementToFormValues(
  requirement: CurriculumDraftRequirement,
): CurriculumRequirementFormValues {
  return {
    courseId: requirement.courseId,
    applicabilityMode: resolveTrainingRequirementApplicabilityMode({
      appliesToAllMembers: requirement.appliesToAllMembers,
      jobFunctionId: requirement.jobFunctionId,
      organisationalUnitId: requirement.organisationalUnitId,
    }),
    jobFunctionId: requirement.jobFunctionId ?? "",
    organisationalUnitId: requirement.organisationalUnitId ?? "",
    mandatory: requirement.mandatory,
    requiredWithinDays:
      requirement.requiredWithinDays != null
        ? String(requirement.requiredWithinDays)
        : "",
    validityDaysOverride:
      requirement.validityDaysOverride != null
        ? String(requirement.validityDaysOverride)
        : "",
    gracePeriodDays:
      requirement.gracePeriodDays != null
        ? String(requirement.gracePeriodDays)
        : "",
    notes: requirement.notes ?? "",
  };
}

function requirementPayload(
  curriculumId: string,
  versionId: string,
  values: CurriculumRequirementFormValues,
) {
  return {
    curriculumId,
    versionId,
    courseId: values.courseId,
    applicabilityMode: values.applicabilityMode,
    jobFunctionId: values.jobFunctionId,
    organisationalUnitId: values.organisationalUnitId,
    mandatory: values.mandatory,
    requiredWithinDays: values.requiredWithinDays,
    validityDaysOverride: values.validityDaysOverride,
    gracePeriodDays: values.gracePeriodDays,
    notes: values.notes,
  };
}

export function CurriculumDraftEditor({
  curriculumId,
  versionId,
  requirements,
  courses,
  jobFunctions,
  units,
}: CurriculumDraftEditorProps) {
  const [values, setValues] = useState(emptyRequirementFormValues());
  const [editingRequirementId, setEditingRequirementId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    "save" | "publish" | "remove" | null
  >(null);

  function startEdit(requirement: CurriculumDraftRequirement) {
    setEditingRequirementId(requirement.id);
    setValues(requirementToFormValues(requirement));
    setError(null);
  }

  function resetForm() {
    setEditingRequirementId(null);
    setValues(emptyRequirementFormValues());
  }

  async function persistOpenForm() {
    const payload = requirementPayload(curriculumId, versionId, values);

    if (editingRequirementId) {
      const result = await updateTrainingRequirement({
        ...payload,
        requirementId: editingRequirementId,
      });
      if ("error" in result) {
        return result;
      }
      return { ok: true as const };
    }

    return addTrainingRequirement(payload);
  }

  async function runSave() {
    if (busyAction) {
      return;
    }

    setBusyAction("save");
    setError(null);

    try {
      const result = await persistOpenForm();
      if ("error" in result) {
        setError(result.error);
        return;
      }

      navigateTo(
        buildAuthoringSavedRedirectPath(
          `/platform/training/curriculum/${curriculumId}`,
          "requirement",
        ),
      );
    } catch {
      setError(
        "Unable to save this requirement. Your entries were kept so you can try again.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function runPublish() {
    if (busyAction) {
      return;
    }

    setBusyAction("publish");
    setError(null);

    try {
      const hasUnsaved = trainingRequirementFormHasUnsavedContent(values);
      if (hasUnsaved || editingRequirementId) {
        if (!values.courseId.trim()) {
          setError(
            "Save or clear the requirement you are editing before publishing.",
          );
          return;
        }

        const saved = await persistOpenForm();
        if ("error" in saved) {
          setError(saved.error);
          return;
        }
      }

      const published = await publishTrainingCurriculumVersion({
        curriculumId,
        versionId,
      });
      if ("error" in published) {
        setError(published.error);
        return;
      }

      navigateTo(
        buildAuthoringSavedRedirectPath(
          `/platform/training/curriculum/${curriculumId}`,
          "publish",
        ),
      );
    } catch {
      setError("Unable to publish this curriculum. Try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runRemove(requirementId: string) {
    if (busyAction) {
      return;
    }

    setBusyAction("remove");
    setError(null);

    try {
      const result = await removeTrainingRequirement({
        curriculumId,
        requirementId,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }

      if (editingRequirementId === requirementId) {
        resetForm();
      }

      navigateTo(
        buildAuthoringSavedRedirectPath(
          `/platform/training/curriculum/${curriculumId}`,
          "requirement",
        ),
      );
    } catch {
      setError("Unable to remove this requirement. Try again.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Card data-testid="training-curriculum-draft-editor">
      <CardHeader>
        <CardTitle>Edit draft requirements</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {courses.length === 0 ? (
          <div
            className="rounded-md border border-dashed border-border px-3 py-4 text-sm"
            data-testid="training-curriculum-no-courses"
          >
            <p className="font-medium">No courses are available yet</p>
            <p className="mt-1 text-muted-foreground">
              Create and publish a course in the organisation catalogue before
              adding requirements.
            </p>
            <Button asChild className="mt-3 min-h-11" variant="outline">
              <AppLink href="/platform/training/courses?new=1">
                New course
              </AppLink>
            </Button>
          </div>
        ) : null}

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Draft requirements</h3>
          {requirements.length === 0 ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="training-curriculum-draft-empty"
            >
              No requirements have been added to this draft yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {requirements.map((requirement) => (
                <li
                  key={requirement.id}
                  className="rounded-md border border-border px-4 py-3"
                  data-testid={`training-curriculum-draft-requirement-${requirement.id}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{requirement.courseName}</p>
                      <p className="text-sm text-muted-foreground">
                        {describeTrainingRequirementApplicability({
                          appliesToAllMembers: requirement.appliesToAllMembers,
                          jobFunctionName: requirement.jobFunctionName,
                          organisationalUnitName:
                            requirement.organisationalUnitName,
                        })}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant={
                            requirement.mandatory ? "success" : "secondary"
                          }
                        >
                          {requirement.mandatory ? "Mandatory" : "Optional"}
                        </Badge>
                        {requirement.requiredWithinDays != null ? (
                          <span>
                            Complete within {requirement.requiredWithinDays}{" "}
                            days
                          </span>
                        ) : null}
                        {requirement.validityDaysOverride != null ? (
                          <span>
                            Validity override {requirement.validityDaysOverride}{" "}
                            days
                          </span>
                        ) : null}
                        {requirement.gracePeriodDays != null ? (
                          <span>
                            Grace period {requirement.gracePeriodDays} days
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={busyAction !== null}
                        onClick={() => startEdit(requirement)}
                        data-testid={`training-requirement-edit-${requirement.id}`}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={busyAction !== null}
                        onClick={() => {
                          void runRemove(requirement.id);
                        }}
                        data-testid={`training-requirement-remove-${requirement.id}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">
            {editingRequirementId ? "Edit requirement" : "Add requirement"}
          </h3>
          <form
            className="flex flex-col gap-4"
            data-testid="training-requirement-editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runSave();
            }}
          >
            <CurriculumRequirementForm
              values={values}
              courses={courses}
              jobFunctions={jobFunctions}
              units={units}
              disabled={busyAction !== null || courses.length === 0}
              onChange={setValues}
            />
            {error ? (
              <p
                className="text-sm text-destructive"
                role="alert"
                data-testid="training-curriculum-draft-error"
              >
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                variant="outline"
                className="min-h-11"
                disabled={busyAction !== null || courses.length === 0}
                data-testid="training-requirement-save"
              >
                {busyAction === "save"
                  ? "Saving requirement…"
                  : editingRequirementId
                    ? "Save requirement"
                    : "Add requirement"}
              </Button>
              {editingRequirementId ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  disabled={busyAction !== null}
                  onClick={resetForm}
                  data-testid="training-requirement-cancel-edit"
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
        </section>

        <section
          className="flex flex-col gap-3 rounded-md border border-border px-4 py-3"
          data-testid="training-curriculum-review"
        >
          <h3 className="text-sm font-semibold">Review before publishing</h3>
          {requirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This draft has no requirements yet. Publishing will still replace
              the current published curriculum.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {requirements.map((requirement) => (
                <li key={`review-${requirement.id}`}>
                  <span className="font-medium">{requirement.courseName}</span>
                  {" — "}
                  {requirement.mandatory ? "mandatory" : "optional"}
                  {" — "}
                  {describeTrainingRequirementApplicability({
                    appliesToAllMembers: requirement.appliesToAllMembers,
                    jobFunctionName: requirement.jobFunctionName,
                    organisationalUnitName: requirement.organisationalUnitName,
                  })}
                  {requirement.requiredWithinDays != null
                    ? ` Complete within ${requirement.requiredWithinDays} days.`
                    : ""}
                  {requirement.validityDaysOverride != null
                    ? ` Validity override ${requirement.validityDaysOverride} days.`
                    : ""}
                  {requirement.gracePeriodDays != null
                    ? ` Grace period ${requirement.gracePeriodDays} days.`
                    : ""}
                </li>
              ))}
            </ul>
          )}
          <p
            className="text-sm text-muted-foreground"
            data-testid="training-curriculum-publish-guidance"
          >
            {trainingCurriculumPublishGuidance()}
          </p>
          <Button
            type="button"
            className="min-h-11 self-start"
            disabled={busyAction !== null}
            onClick={() => {
              void runPublish();
            }}
            data-testid="training-curriculum-publish"
          >
            {busyAction === "publish" ? "Publishing…" : "Publish curriculum"}
          </Button>
        </section>
      </CardContent>
    </Card>
  );
}
