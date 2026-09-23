"use client";

import { useState } from "react";

import {
  publishTrainingCourseVersion,
  updateTrainingCourseDraftVersion,
} from "@/app/(platform)/platform/training/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildAuthoringSavedRedirectPath } from "@/lib/authoring/authoring-query";
import { navigateTo } from "@/lib/navigation/navigate";
import {
  TRAINING_DELIVERY_METHODS,
  trainingCoursePublishGuidance,
  trainingDeliveryMethodLabel,
} from "@/modules/training/catalog-admin";

export type CourseDraftEditorValues = {
  durationMinutes: string;
  validityDays: string;
  deliveryMethod: string;
  learningObjectives: string;
  trainerRequirements: string;
  evidenceNotes: string;
};

type CourseDraftEditorProps = {
  courseId: string;
  versionId: string;
  versionNumber: number;
  initialValues: CourseDraftEditorValues;
};

export function CourseDraftEditor({
  courseId,
  versionId,
  versionNumber,
  initialValues,
}: CourseDraftEditorProps) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "publish" | null>(null);

  function updateField<K extends keyof CourseDraftEditorValues>(
    field: K,
    value: CourseDraftEditorValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function runAction(action: "save" | "publish") {
    if (busyAction) {
      return;
    }

    setBusyAction(action);
    setError(null);

    try {
      const payload = {
        courseId,
        versionId,
        durationMinutes: values.durationMinutes,
        validityDays: values.validityDays,
        deliveryMethod: values.deliveryMethod,
        learningObjectives: values.learningObjectives,
        trainerRequirements: values.trainerRequirements,
        evidenceNotes: values.evidenceNotes,
      };

      if (action === "save") {
        const result = await updateTrainingCourseDraftVersion(payload);
        if ("error" in result) {
          setError(result.error);
          return;
        }

        navigateTo(
          buildAuthoringSavedRedirectPath(
            `/platform/training/courses/${courseId}`,
            "course",
          ),
        );
        return;
      }

      const saved = await updateTrainingCourseDraftVersion(payload);
      if ("error" in saved) {
        setError(saved.error);
        return;
      }

      const published = await publishTrainingCourseVersion({
        courseId,
        versionId,
      });
      if ("error" in published) {
        setError(published.error);
        return;
      }

      navigateTo(
        buildAuthoringSavedRedirectPath(
          `/platform/training/courses/${courseId}`,
          "publish",
        ),
      );
    } catch {
      setError(
        action === "publish"
          ? "Unable to publish this course. Try again."
          : "Unable to save this draft. Your entries were kept so you can try again.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Card data-testid="training-course-draft-editor">
      <CardHeader>
        <CardTitle>Edit draft version {versionNumber}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          data-testid="training-course-draft-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction("save");
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="training-course-duration">
                Duration (minutes)
              </Label>
              <Input
                id="training-course-duration"
                type="number"
                min={1}
                inputMode="numeric"
                value={values.durationMinutes}
                onChange={(event) =>
                  updateField("durationMinutes", event.target.value)
                }
                data-testid="training-course-duration-input"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="training-course-validity">Validity (days)</Label>
              <Input
                id="training-course-validity"
                type="number"
                min={1}
                inputMode="numeric"
                value={values.validityDays}
                onChange={(event) =>
                  updateField("validityDays", event.target.value)
                }
                data-testid="training-course-validity-input"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank when the course does not expire.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="training-course-delivery">Delivery method</Label>
            <select
              id="training-course-delivery"
              className="border-input min-h-11 w-full rounded-md border bg-elevated px-3 py-2 text-sm"
              value={values.deliveryMethod}
              onChange={(event) =>
                updateField("deliveryMethod", event.target.value)
              }
              data-testid="training-course-delivery-input"
            >
              <option value="">Not specified</option>
              {TRAINING_DELIVERY_METHODS.map((method) => (
                <option key={method} value={method}>
                  {trainingDeliveryMethodLabel(method)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="training-course-objectives">
              Learning objectives
            </Label>
            <Textarea
              id="training-course-objectives"
              rows={4}
              value={values.learningObjectives}
              placeholder="What people should be able to do after this course."
              onChange={(event) =>
                updateField("learningObjectives", event.target.value)
              }
              data-testid="training-course-objectives-input"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="training-course-trainer">
              Trainer requirements
            </Label>
            <Textarea
              id="training-course-trainer"
              rows={3}
              value={values.trainerRequirements}
              placeholder="Who can deliver this course."
              onChange={(event) =>
                updateField("trainerRequirements", event.target.value)
              }
              data-testid="training-course-trainer-input"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="training-course-evidence">
              Evidence requirements
            </Label>
            <Textarea
              id="training-course-evidence"
              rows={3}
              value={values.evidenceNotes}
              placeholder="What evidence shows the course was completed."
              onChange={(event) =>
                updateField("evidenceNotes", event.target.value)
              }
              data-testid="training-course-evidence-input"
            />
          </div>
          <p
            className="text-sm text-muted-foreground"
            data-testid="training-course-publish-guidance"
          >
            {trainingCoursePublishGuidance()}
          </p>
          {error ? (
            <p
              className="text-sm text-destructive"
              role="alert"
              data-testid="training-course-draft-error"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              variant="outline"
              className="min-h-11"
              disabled={busyAction !== null}
              data-testid="training-course-save-draft"
            >
              {busyAction === "save" ? "Saving draft…" : "Save draft"}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={busyAction !== null}
              onClick={() => {
                void runAction("publish");
              }}
              data-testid="training-course-publish"
            >
              {busyAction === "publish" ? "Publishing…" : "Publish course"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
