"use client";

import { useMemo, useState } from "react";

import { createTrainingCourseDraft } from "@/app/(platform)/platform/training/actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { navigateTo } from "@/lib/navigation/navigate";
import {
  generateTrainingCourseCode,
  resolveTrainingCourseCreateCode,
  resolveUniqueTrainingCourseCode,
} from "@/modules/training/catalog-code";

type CourseCreateFormProps = {
  existingCodes: readonly string[];
  cancelHref?: string;
};

export function CourseCreateForm({
  existingCodes,
  cancelHref,
}: CourseCreateFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const autoCode = useMemo(
    () =>
      resolveUniqueTrainingCourseCode(
        generateTrainingCourseCode(name),
        existingCodes,
      ),
    [existingCodes, name],
  );

  return (
    <Card data-testid="training-course-create-card">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <CardTitle>New course</CardTitle>
        {cancelHref ? (
          <Button variant="ghost" size="sm" asChild>
            <AppLink href={cancelHref}>Cancel</AppLink>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          data-testid="training-course-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (submitting) {
              return;
            }

            const resolved = resolveTrainingCourseCreateCode({
              name,
              existingCodes,
              ...(useCustomCode ? { customCode } : {}),
            });

            if (!resolved.ok) {
              setError(resolved.message);
              return;
            }

            setSubmitting(true);
            setError(null);

            void createTrainingCourseDraft({
              name: name.trim(),
              code: resolved.code,
              ...(category.trim() ? { category: category.trim() } : {}),
              ...(description.trim()
                ? { description: description.trim() }
                : {}),
            })
              .then((result) => {
                if ("error" in result || !("courseId" in result)) {
                  setError(
                    "error" in result
                      ? result.error
                      : "Unable to create this course. Check the details and try again.",
                  );
                  setSubmitting(false);
                  return;
                }

                navigateTo(`/platform/training/courses/${result.courseId}`);
              })
              .catch(() => {
                setError(
                  "Unable to create this course. Check the details and try again.",
                );
                setSubmitting(false);
              });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="training-course-name">Course name</Label>
            <Input
              id="training-course-name"
              name="name"
              required
              maxLength={160}
              value={name}
              placeholder="Forklift safety"
              onChange={(event) => setName(event.target.value)}
              data-testid="training-course-name-input"
            />
          </div>
          {!useCustomCode ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="training-course-auto-code-preview"
            >
              Course code:{" "}
              <span className="font-medium text-foreground">
                {autoCode || "Enter a name to generate a code"}
              </span>
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto self-start px-0 text-primary underline-offset-4 hover:underline"
            disabled={submitting}
            onClick={() => {
              setUseCustomCode((current) => {
                const next = !current;
                setCustomCode(next ? autoCode : "");
                return next;
              });
            }}
            data-testid="training-course-custom-code-toggle"
          >
            {useCustomCode
              ? "Use generated code"
              : "Advanced: override course code"}
          </Button>
          {useCustomCode ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="training-course-custom-code">Course code</Label>
              <Input
                id="training-course-custom-code"
                name="code"
                required
                value={customCode}
                onChange={(event) => setCustomCode(event.target.value)}
                data-testid="training-course-custom-code-input"
              />
              <p className="text-xs text-muted-foreground">
                Use lowercase letters, numbers, dots, hyphens, or underscores.
              </p>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="training-course-category">
              Category <span className="font-normal">(optional)</span>
            </Label>
            <Input
              id="training-course-category"
              name="category"
              value={category}
              placeholder="Safety"
              onChange={(event) => setCategory(event.target.value)}
              data-testid="training-course-category-input"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="training-course-description">
              Description <span className="font-normal">(optional)</span>
            </Label>
            <Textarea
              id="training-course-description"
              name="description"
              rows={3}
              value={description}
              placeholder="What this course covers and who it is for."
              onChange={(event) => setDescription(event.target.value)}
              data-testid="training-course-description-input"
            />
          </div>
          {error ? (
            <p
              className="text-sm text-destructive"
              role="alert"
              data-testid="training-course-create-error"
            >
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="min-h-11 self-start"
            disabled={submitting}
            data-testid="training-course-create-submit"
          >
            {submitting ? "Creating course…" : "Create draft course"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
