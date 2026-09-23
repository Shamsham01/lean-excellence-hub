"use client";

import { useMemo, useState } from "react";

import { createTrainingCurriculumDraft } from "@/app/(platform)/platform/training/curriculum-actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { navigateTo } from "@/lib/navigation/navigate";
import {
  generateTrainingCurriculumCode,
  resolveTrainingCurriculumCreateCode,
  resolveUniqueTrainingCurriculumCode,
} from "@/modules/training/curriculum-code";

type CurriculumCreateFormProps = {
  existingCodes: readonly string[];
  cancelHref?: string;
};

export function CurriculumCreateForm({
  existingCodes,
  cancelHref,
}: CurriculumCreateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const autoCode = useMemo(
    () =>
      resolveUniqueTrainingCurriculumCode(
        generateTrainingCurriculumCode(name),
        existingCodes,
      ),
    [existingCodes, name],
  );

  return (
    <Card data-testid="training-curriculum-create-card">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <CardTitle>New curriculum</CardTitle>
        {cancelHref ? (
          <Button variant="ghost" size="sm" asChild>
            <AppLink href={cancelHref}>Cancel</AppLink>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          data-testid="training-curriculum-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (submitting) {
              return;
            }

            const resolved = resolveTrainingCurriculumCreateCode({
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

            void createTrainingCurriculumDraft({
              name: name.trim(),
              code: resolved.code,
              ...(description.trim()
                ? { description: description.trim() }
                : {}),
            })
              .then((result) => {
                if ("error" in result || !("curriculumId" in result)) {
                  setError(
                    "error" in result
                      ? result.error
                      : "Unable to create this curriculum. Check the details and try again.",
                  );
                  setSubmitting(false);
                  return;
                }

                navigateTo(
                  `/platform/training/curriculum/${result.curriculumId}`,
                );
              })
              .catch(() => {
                setError(
                  "Unable to create this curriculum. Check the details and try again.",
                );
                setSubmitting(false);
              });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="training-curriculum-name">Curriculum name</Label>
            <Input
              id="training-curriculum-name"
              name="name"
              required
              maxLength={160}
              value={name}
              placeholder="Core operations curriculum"
              onChange={(event) => setName(event.target.value)}
              data-testid="training-curriculum-name-input"
            />
          </div>
          {!useCustomCode ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="training-curriculum-auto-code-preview"
            >
              Curriculum code:{" "}
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
            data-testid="training-curriculum-custom-code-toggle"
          >
            {useCustomCode
              ? "Use generated code"
              : "Advanced: override curriculum code"}
          </Button>
          {useCustomCode ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="training-curriculum-custom-code">
                Curriculum code
              </Label>
              <Input
                id="training-curriculum-custom-code"
                name="code"
                required
                value={customCode}
                onChange={(event) => setCustomCode(event.target.value)}
                data-testid="training-curriculum-custom-code-input"
              />
              <p className="text-xs text-muted-foreground">
                Use lowercase letters, numbers, dots, hyphens, or underscores.
              </p>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="training-curriculum-description">
              Description <span className="font-normal">(optional)</span>
            </Label>
            <Textarea
              id="training-curriculum-description"
              name="description"
              rows={3}
              value={description}
              placeholder="What this curriculum covers and who it is for."
              onChange={(event) => setDescription(event.target.value)}
              data-testid="training-curriculum-description-input"
            />
          </div>
          {error ? (
            <p
              className="text-sm text-destructive"
              role="alert"
              data-testid="training-curriculum-create-error"
            >
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="min-h-11 self-start"
            disabled={submitting}
            data-testid="training-curriculum-create-submit"
          >
            {submitting ? "Creating curriculum…" : "Create draft curriculum"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
