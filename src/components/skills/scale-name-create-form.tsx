"use client";

import { useState } from "react";

import { createProficiencyScale } from "@/app/(platform)/platform/skills/actions";
import { SkillsFieldError } from "@/components/skills/skills-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { navigateTo } from "@/lib/navigation/navigate";
export function ScaleNameCreateForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      data-testid="scale-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting || !name.trim()) return;
        setSubmitting(true);
        setError(null);
        void createProficiencyScale({
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          levels: [
            { order: 1, label: "Level 1" },
            { order: 2, label: "Level 2" },
          ],
        })
          .then((result) => {
            if ("scaleId" in result && result.scaleId) {
              onCreated?.();
              navigateTo(`/platform/skills/scales/${result.scaleId}`);
              return;
            }
            setError(
              "error" in result ? result.error : "Unable to create this scale.",
            );
            setSubmitting(false);
          })
          .catch(() => {
            setError("Unable to create this scale.");
            setSubmitting(false);
          });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="scale-name">Scale name</Label>
        <Input
          id="scale-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="scale-description">Description (optional)</Label>
        <Textarea
          id="scale-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </div>
      {error ? (
        <SkillsFieldError id="scale-create-error" testId="scale-create-error">
          {error}
        </SkillsFieldError>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={submitting}>
        {submitting ? "Creating…" : "Create and edit levels"}
      </Button>
    </form>
  );
}
