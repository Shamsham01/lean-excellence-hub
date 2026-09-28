"use client";

import { useState, useTransition } from "react";

import { createMaturityAction } from "@/app/(platform)/platform/maturity/actions";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type QuestionOption = {
  id: string;
  prompt: string;
};

export function AssessmentActionForm({
  assessmentId,
  pillarId,
  criterionId,
  questions,
}: {
  assessmentId: string;
  pillarId: string;
  criterionId: string;
  questions: QuestionOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdActionId, setCreatedActionId] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      setError(null);
      const result = await createMaturityAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.actionId) {
        setCreatedActionId(result.actionId);
        form.reset();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      data-testid={`assessment-action-form-${criterionId}`}
    >
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="pillarId" value={pillarId} />
      <input type="hidden" name="criterionId" value={criterionId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`action-title-${criterionId}`}>Create action</Label>
        <Input
          id={`action-title-${criterionId}`}
          name="title"
          required
          placeholder="Improvement action"
        />
      </div>
      {questions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`action-question-${criterionId}`}>
            Related question
          </Label>
          <select
            id={`action-question-${criterionId}`}
            name="questionId"
            className="min-h-9 rounded-md border border-border bg-background px-3 text-sm"
            defaultValue=""
          >
            <option value="">This criterion</option>
            {questions.map((question) => (
              <option key={question.id} value={question.id}>
                {question.prompt}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Textarea name="description" rows={2} placeholder="Finding context" />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {createdActionId ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid="action-created"
        >
          Action created.{" "}
          <AppLink
            href={`/platform/actions/${createdActionId}`}
            className="underline"
          >
            Open action
          </AppLink>
        </p>
      ) : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Creating…" : "Create action"}
      </Button>
    </form>
  );
}
