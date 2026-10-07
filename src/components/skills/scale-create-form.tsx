"use client";

import { useState } from "react";

import { createProficiencyScale } from "@/app/(platform)/platform/skills/actions";
import {
  blankScaleLevel,
  nextScaleLevelOrder,
  ScaleLevelEditor,
  type ScaleLevelDraft,
} from "@/components/skills/scale-level-editor";
import { SkillsFieldError } from "@/components/skills/skills-field";
import { AppLink } from "@/components/ui/app-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { navigateTo } from "@/lib/navigation/navigate";

function persistedLevels(levels: ScaleLevelDraft[]) {
  return levels
    .filter(
      (level) =>
        level.label.trim() || level.description.trim() || level.guidance.trim(),
    )
    .map((level) => ({
      order: level.order,
      label: level.label.trim(),
      ...(level.description.trim()
        ? { description: level.description.trim() }
        : {}),
      ...(level.guidance.trim() ? { guidance: level.guidance.trim() } : {}),
    }));
}

export function ScaleCreateForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [levels, setLevels] = useState<ScaleLevelDraft[]>([
    blankScaleLevel(1),
    blankScaleLevel(2),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [continueHref, setContinueHref] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="flex min-w-0 flex-col gap-6"
      data-testid="scale-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting) {
          return;
        }

        const readyLevels = persistedLevels(levels);
        if (readyLevels.some((level) => !level.label)) {
          setError("Enter a label for every level you have started.");
          return;
        }

        setSubmitting(true);
        setError(null);
        setContinueHref(null);

        void createProficiencyScale({
          name,
          ...(description.trim() ? { description: description.trim() } : {}),
          levels: readyLevels,
        })
          .then((result) => {
            if ("scaleId" in result && !("error" in result)) {
              navigateTo(`/platform/skills/scales/${result.scaleId}`);
              return;
            }

            if ("scaleId" in result && "error" in result) {
              setContinueHref(`/platform/skills/scales/${result.scaleId}`);
              setError(result.error);
              setSubmitting(false);
              return;
            }

            setError(
              "error" in result
                ? result.error
                : "Unable to create this proficiency scale.",
            );
            setSubmitting(false);
          })
          .catch(() => {
            setError("Unable to create this proficiency scale.");
            setSubmitting(false);
          });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="scale-name">Scale name</Label>
        <Input
          id="scale-name"
          name="name"
          required
          maxLength={160}
          value={name}
          placeholder="Operational proficiency"
          onChange={(event) => setName(event.target.value)}
          data-testid="scale-name-input"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="scale-description">
          Description <span className="font-normal">(optional)</span>
        </Label>
        <Textarea
          id="scale-description"
          name="description"
          maxLength={2000}
          rows={3}
          value={description}
          placeholder="How this organisation measures capability."
          onChange={(event) => setDescription(event.target.value)}
          data-testid="scale-description-input"
        />
      </div>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="text-sm font-medium">Proficiency levels</legend>
        <p className="text-sm text-muted-foreground">
          Define your own labels. Saved levels cannot be edited or removed after
          this draft is created, so review them before you continue. Publish
          needs at least two levels.
        </p>
        <ScaleLevelEditor
          idPrefix="scale"
          levels={levels}
          disabled={submitting}
          onChange={setLevels}
        />
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={submitting || levels.length >= 20}
          onClick={() =>
            setLevels((current) => [
              ...current,
              blankScaleLevel(nextScaleLevelOrder(current)),
            ])
          }
          data-testid="scale-add-level"
        >
          Add level
        </Button>
      </fieldset>

      {error ? (
        <SkillsFieldError id="scale-create-error" testId="scale-create-error">
          {error}
        </SkillsFieldError>
      ) : null}
      {continueHref ? (
        <AppLink href={continueHref} className="text-sm hover:underline">
          Continue to the draft
        </AppLink>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={submitting}
          data-testid="scale-create-submit"
        >
          {submitting ? "Creating draft…" : "Create draft"}
        </Button>
        <Button variant="outline" asChild>
          <AppLink href="/platform/skills/scales">Cancel</AppLink>
        </Button>
      </div>
    </form>
  );
}
