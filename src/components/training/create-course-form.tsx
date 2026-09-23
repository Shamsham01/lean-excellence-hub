"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";

import { createTrainingCourseAction } from "@/app/(platform)/platform/training/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  generateTrainingCourseCode,
  resolveUniqueTrainingCourseCode,
} from "@/modules/training/catalog-code";

type CreateCourseFormProps = {
  existingCodes: readonly string[];
};

type FormState = {
  error?: string;
  name?: string;
  category?: string;
  description?: string;
  customCode?: string;
};

const initialState: FormState = {};

type CreateCourseFormFieldsProps = {
  existingCodes: readonly string[];
  state: FormState;
  formAction: (payload: FormData) => void;
  pending: boolean;
};

function CreateCourseFormFields({
  existingCodes,
  state,
  formAction,
  pending,
}: CreateCourseFormFieldsProps) {
  const [showAdvanced, setShowAdvanced] = useState(Boolean(state.customCode));
  const [name, setName] = useState(state.name ?? "");
  const [customCode, setCustomCode] = useState(state.customCode ?? "");

  const generatedCode = useMemo(() => {
    if (showAdvanced && customCode.trim()) {
      return customCode.trim().toLowerCase();
    }
    return resolveUniqueTrainingCourseCode(
      generateTrainingCourseCode(name),
      existingCodes,
    );
  }, [customCode, existingCodes, name, showAdvanced]);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <div>
        <Label htmlFor="courseName">Course name</Label>
        <Input
          id="courseName"
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Lean basics"
          className="mt-2 min-h-11"
          data-testid="training-course-name-input"
        />
      </div>
      <div>
        <Label htmlFor="courseCategory">Category (optional)</Label>
        <Input
          id="courseCategory"
          name="category"
          defaultValue={state.category ?? ""}
          placeholder="Foundation"
          className="mt-2 min-h-11"
          data-testid="training-course-category-input"
        />
      </div>
      <div>
        <Label htmlFor="courseDescription">Description (optional)</Label>
        <Textarea
          id="courseDescription"
          name="description"
          defaultValue={state.description ?? ""}
          rows={3}
          className="mt-2"
          data-testid="training-course-description-input"
        />
      </div>
      <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm">
        <p className="text-muted-foreground">Course code</p>
        <p
          className="mt-1 font-medium text-foreground"
          data-testid="training-course-generated-code"
        >
          {generatedCode || "Enter a course name to generate a code"}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-auto justify-start px-0 text-sm"
          onClick={() => setShowAdvanced((current) => !current)}
          data-testid="training-course-advanced-toggle"
        >
          {showAdvanced
            ? "Hide advanced code override"
            : "Advanced code override"}
        </Button>
        {showAdvanced ? (
          <div>
            <Label htmlFor="courseCustomCode">Custom code</Label>
            <Input
              id="courseCustomCode"
              name="customCode"
              value={customCode}
              onChange={(event) => setCustomCode(event.target.value)}
              placeholder="lean-basics"
              className="mt-2 min-h-11"
              data-testid="training-course-custom-code-input"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Lowercase letters, numbers, dots, hyphens, or underscores. Must be
              unique in your organisation.
            </p>
          </div>
        ) : null}
      </div>
      {state.error ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="training-course-create-error"
        >
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        className="min-h-11"
        disabled={pending}
        data-testid="training-course-create-submit"
      >
        {pending ? "Creating…" : "Create draft course"}
      </Button>
    </form>
  );
}

export function CreateCourseForm({ existingCodes }: CreateCourseFormProps) {
  const [state, formAction, pending] = useActionState(
    createTrainingCourseAction,
    initialState,
  );
  const preservedKey = [
    state.error ?? "",
    state.name ?? "",
    state.category ?? "",
    state.description ?? "",
    state.customCode ?? "",
  ].join("|");

  return (
    <CreateCourseFormFields
      key={preservedKey}
      existingCodes={existingCodes}
      state={state}
      formAction={formAction}
      pending={pending}
    />
  );
}
