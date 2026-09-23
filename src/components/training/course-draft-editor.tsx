"use client";

import { useActionState } from "react";

import { saveOrPublishTrainingCourseDraftAction } from "@/app/(platform)/platform/training/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TRAINING_DELIVERY_METHODS,
  type TrainingCourseDraftFormState,
} from "@/modules/training/catalog-admin";

type CourseDraftEditorProps = {
  courseId: string;
  versionId: string;
  versionNumber: number;
  initialValidityDays: number | null;
  initialDurationMinutes: number | null;
  initialDeliveryMethod: string | null;
  initialLearningObjectives: string | null;
  initialTrainerRequirements: string | null;
  recommendations: string[];
};

function draftStateKey(state: TrainingCourseDraftFormState) {
  return [
    state.error ?? "",
    state.courseId,
    state.versionId,
    state.deliveryMethod,
    state.learningObjectives,
    state.trainerRequirements,
    state.durationMinutes,
    state.validityDays,
  ].join("|");
}

function CourseDraftEditorFields({
  defaults,
  recommendations,
  versionNumber,
  formAction,
  pending,
}: {
  defaults: TrainingCourseDraftFormState;
  recommendations: string[];
  versionNumber: number;
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  return (
    <form
      action={formAction}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      <input type="hidden" name="courseId" value={defaults.courseId} />
      <input type="hidden" name="versionId" value={defaults.versionId} />
      <p className="text-sm text-muted-foreground">
        Edit the draft below. Published content stays read-only until you create
        a successor version. Publishing saves the current draft first.
      </p>
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="validityDays">Qualification validity (days)</Label>
          <Input
            id="validityDays"
            name="validityDays"
            type="number"
            min={1}
            defaultValue={defaults.validityDays}
            placeholder="365"
            className="mt-2 min-h-11"
            data-testid="training-course-validity-input"
          />
        </div>
        <div>
          <Label htmlFor="durationMinutes">Estimated duration (minutes)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={1}
            defaultValue={defaults.durationMinutes}
            placeholder="240"
            className="mt-2 min-h-11"
            data-testid="training-course-duration-input"
          />
        </div>
        <div>
          <Label htmlFor="deliveryMethod">Delivery method</Label>
          <select
            id="deliveryMethod"
            name="deliveryMethod"
            defaultValue={defaults.deliveryMethod}
            className="mt-2 min-h-11 w-full rounded-md border border-border px-3"
            data-testid="training-course-delivery-select"
          >
            <option value="">Select a delivery method</option>
            {TRAINING_DELIVERY_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="learningObjectives">Learning objectives</Label>
          <Textarea
            id="learningObjectives"
            name="learningObjectives"
            rows={4}
            defaultValue={defaults.learningObjectives}
            className="mt-2"
            data-testid="training-course-objectives-input"
          />
        </div>
        <div>
          <Label htmlFor="trainerRequirements">
            Trainer requirements (optional)
          </Label>
          <Textarea
            id="trainerRequirements"
            name="trainerRequirements"
            rows={3}
            defaultValue={defaults.trainerRequirements}
            className="mt-2"
            data-testid="training-course-trainer-input"
          />
        </div>
      </div>
      {defaults.error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="training-course-draft-error"
        >
          {defaults.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          name="intent"
          value="save"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          data-testid="training-course-save-draft"
        >
          {pending ? "Saving…" : "Save draft details"}
        </Button>
      </div>
      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold">
          Publish course v{versionNumber}
        </h3>
        {recommendations.length > 0 ? (
          <ul
            className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground"
            data-testid="training-course-publish-recommendations"
          >
            {recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            This draft is ready to publish. Publishing saves any unsaved edits
            and makes the course available organisation-wide in the training
            catalogue.
          </p>
        )}
        <Button
          type="submit"
          name="intent"
          value="publish"
          className="mt-4 min-h-11"
          disabled={pending}
          data-testid="training-course-publish"
        >
          {pending ? "Publishing…" : "Publish course"}
        </Button>
      </div>
    </form>
  );
}

export function CourseDraftEditor({
  courseId,
  versionId,
  versionNumber,
  initialValidityDays,
  initialDurationMinutes,
  initialDeliveryMethod,
  initialLearningObjectives,
  initialTrainerRequirements,
  recommendations,
}: CourseDraftEditorProps) {
  const initialState: TrainingCourseDraftFormState = {
    courseId,
    versionId,
    deliveryMethod: initialDeliveryMethod ?? "",
    learningObjectives: initialLearningObjectives ?? "",
    trainerRequirements: initialTrainerRequirements ?? "",
    durationMinutes:
      initialDurationMinutes != null ? String(initialDurationMinutes) : "",
    validityDays:
      initialValidityDays != null ? String(initialValidityDays) : "",
  };
  const [state, formAction, pending] = useActionState(
    saveOrPublishTrainingCourseDraftAction,
    initialState,
  );
  const defaults = state.error ? state : initialState;

  return (
    <CourseDraftEditorFields
      key={draftStateKey(defaults)}
      defaults={defaults}
      recommendations={recommendations}
      versionNumber={versionNumber}
      formAction={formAction}
      pending={pending}
    />
  );
}
